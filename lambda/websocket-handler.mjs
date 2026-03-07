// WebSocket Handler - Real-time communication
import { DynamoDBClient, PutItemCommand, DeleteItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const lambda = new LambdaClient({ region: process.env.AWS_REGION });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || "ai-classroom-connections";
const AI_HANDLER_FUNCTION = process.env.AI_HANDLER_FUNCTION;

// Send message to a specific connection
async function sendToConnection(endpoint, connectionId, data) {
  const apiGateway = new ApiGatewayManagementApiClient({ endpoint });
  
  try {
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data)
    }));
    return true;
  } catch (error) {
    if (error.statusCode === 410) {
      console.log(`Stale connection: ${connectionId}`);
      // Remove stale connection
      await dynamodb.send(new DeleteItemCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: { S: connectionId } }
      }));
    }
    return false;
  }
}

// Broadcast to all connections in a session
async function broadcastToSession(endpoint, sessionId, data, excludeConnectionId = null) {
  // Query all connections in this session
  const result = await dynamodb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "sessionId-index",
    KeyConditionExpression: "sessionId = :sessionId",
    ExpressionAttributeValues: {
      ":sessionId": { S: sessionId }
    }
  }));

  const connections = result.Items || [];
  const sendPromises = connections
    .filter(item => item.connectionId.S !== excludeConnectionId)
    .map(item => sendToConnection(endpoint, item.connectionId.S, data));

  await Promise.all(sendPromises);
}

// Handle connection
async function handleConnect(connectionId, queryParams) {
  const sessionId = queryParams?.sessionId || "default";
  const userId = queryParams?.userId || `user-${Date.now()}`;

  await dynamodb.send(new PutItemCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId: { S: connectionId },
      sessionId: { S: sessionId },
      userId: { S: userId },
      connectedAt: { N: Date.now().toString() },
      ttl: { N: (Math.floor(Date.now() / 1000) + 86400).toString() } // 24h TTL
    }
  }));

  return { statusCode: 200, body: "Connected" };
}

// Handle disconnect
async function handleDisconnect(connectionId) {
  await dynamodb.send(new DeleteItemCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId: { S: connectionId } }
  }));

  return { statusCode: 200, body: "Disconnected" };
}

// Handle messages
async function handleMessage(endpoint, connectionId, body) {
  const message = JSON.parse(body);
  const { action, sessionId, data } = message;

  console.log(`Action: ${action}, SessionId: ${sessionId}`);

  switch (action) {
    case "chat":
      // User sent a chat message - call AI handler
      return await handleChatMessage(endpoint, connectionId, sessionId, data);

    case "whiteboard":
      // Whiteboard update - broadcast to session
      await broadcastToSession(endpoint, sessionId, {
        type: "whiteboard",
        data
      }, connectionId);
      return { statusCode: 200, body: "Whiteboard synced" };

    case "code":
      // Code editor update - broadcast to session
      await broadcastToSession(endpoint, sessionId, {
        type: "code",
        data
      }, connectionId);
      return { statusCode: 200, body: "Code synced" };

    case "webrtc-signal":
      // WebRTC signaling - forward to specific peer
      const { targetUserId, signal } = data;
      await forwardSignalToPeer(endpoint, sessionId, targetUserId, {
        type: "webrtc-signal",
        signal,
        fromUserId: data.fromUserId
      });
      return { statusCode: 200, body: "Signal forwarded" };

    default:
      return { statusCode: 400, body: "Unknown action" };
  }
}

// Handle chat message with AI
async function handleChatMessage(endpoint, connectionId, sessionId, data) {
  const { prompt, messages, whiteboardText, image, screenShareOn } = data;

  // Invoke AI handler Lambda
  try {
    const response = await lambda.send(new InvokeCommand({
      FunctionName: AI_HANDLER_FUNCTION,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify({
        sessionId,
        prompt,
        messages,
        whiteboardText,
        image,
        screenShareOn
      })
    }));

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    const aiResponse = JSON.parse(result.body);

    // Send AI response back to all users in session
    await broadcastToSession(endpoint, sessionId, {
      type: "ai-response",
      data: aiResponse
    });

    return { statusCode: 200, body: "AI response sent" };
  } catch (error) {
    console.error("AI handler error:", error);
    
    // Send error to user
    await sendToConnection(endpoint, connectionId, {
      type: "error",
      message: "AI service temporarily unavailable"
    });

    return { statusCode: 500, body: "AI error" };
  }
}

// Forward WebRTC signal to specific peer
async function forwardSignalToPeer(endpoint, sessionId, targetUserId, data) {
  // Find target user's connection
  const result = await dynamodb.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: "sessionId-index",
    KeyConditionExpression: "sessionId = :sessionId",
    FilterExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":sessionId": { S: sessionId },
      ":userId": { S: targetUserId }
    }
  }));

  if (result.Items && result.Items.length > 0) {
    const targetConnectionId = result.Items[0].connectionId.S;
    await sendToConnection(endpoint, targetConnectionId, data);
  }
}

// Main handler
export const handler = async (event) => {
  console.log("WebSocket event:", JSON.stringify(event));

  const { requestContext, body, queryStringParameters } = event;
  const { connectionId, routeKey, domainName, stage } = requestContext;
  const endpoint = `https://${domainName}/${stage}`;

  try {
    switch (routeKey) {
      case "$connect":
        return await handleConnect(connectionId, queryStringParameters);

      case "$disconnect":
        return await handleDisconnect(connectionId);

      case "$default":
        return await handleMessage(endpoint, connectionId, body);

      default:
        return { statusCode: 400, body: "Unknown route" };
    }
  } catch (error) {
    console.error("Handler error:", error);
    return { statusCode: 500, body: "Internal error" };
  }
};
