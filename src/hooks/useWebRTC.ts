import { useEffect, useRef, useState } from 'react';

interface Peer {
  userId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

interface UseWebRTCOptions {
  localStream: MediaStream | null;
  onRemoteStream?: (userId: string, stream: MediaStream) => void;
  onPeerDisconnected?: (userId: string) => void;
  sendSignal: (targetUserId: string, signal: any, fromUserId: string) => void;
  userId: string;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const peersRef = useRef<Map<string, Peer>>(new Map());

  const createPeerConnection = (userId: string): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Add local tracks
    if (options.localStream) {
      options.localStream.getTracks().forEach(track => {
        pc.addTrack(track, options.localStream!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from', userId);
      if (options.onRemoteStream && event.streams[0]) {
        options.onRemoteStream(userId, event.streams[0]);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        options.sendSignal(userId, {
          type: 'ice-candidate',
          candidate: event.candidate
        }, options.userId);
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(userId);
        if (options.onPeerDisconnected) {
          options.onPeerDisconnected(userId);
        }
      }
    };

    return pc;
  };

  const addPeer = (userId: string) => {
    if (peersRef.current.has(userId)) return;

    const pc = createPeerConnection(userId);
    const peer: Peer = { userId, connection: pc };
    
    peersRef.current.set(userId, peer);
    setPeers(new Map(peersRef.current));

    return peer;
  };

  const removePeer = (userId: string) => {
    const peer = peersRef.current.get(userId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(userId);
      setPeers(new Map(peersRef.current));
    }
  };

  const createOffer = async (userId: string) => {
    const peer = addPeer(userId);
    if (!peer) return;

    try {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      
      options.sendSignal(userId, {
        type: 'offer',
        sdp: offer
      }, options.userId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleSignal = async (fromUserId: string, signal: any) => {
    let peer = peersRef.current.get(fromUserId);

    if (signal.type === 'offer') {
      if (!peer) {
        peer = addPeer(fromUserId);
      }
      if (!peer) return;

      try {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        
        options.sendSignal(fromUserId, {
          type: 'answer',
          sdp: answer
        }, options.userId);
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    } else if (signal.type === 'answer') {
      if (!peer) return;
      
      try {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    } else if (signal.type === 'ice-candidate') {
      if (!peer) return;
      
      try {
        await peer.connection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  // Update tracks when local stream changes
  useEffect(() => {
    peersRef.current.forEach(peer => {
      const senders = peer.connection.getSenders();
      
      if (options.localStream) {
        options.localStream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            peer.connection.addTrack(track, options.localStream!);
          }
        });
      }
    });
  }, [options.localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(peer => {
        peer.connection.close();
      });
      peersRef.current.clear();
    };
  }, []);

  return {
    peers,
    createOffer,
    handleSignal,
    removePeer
  };
}
