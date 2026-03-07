# 🔒 Remove Fallback - AWS Lambda Only

## Quick Summary

Since WebSocket is working, we'll remove the fallback to have only ONE secure API key in Lambda.

## Changes Needed

### 1. Update .env.local ✅ (Already Done)
Removed `VITE_GEMINI_API_KEY` from the file.

### 2. Update Classroom.tsx

Replace the fallback section (lines ~862-1355) with AWS-only error handling.

The section to replace starts with:
```typescript
} catch (awsError) {
  console.warn('⚠️ AWS Lambda unavailable, using fallback:', awsError);
}

// Fallback: Use direct Gemini API (existing code)
console.log('🔄 Using fallback: Direct Gemini API');
try {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  // ... huge block of code ...
```

And ends with:
```typescript
    } catch (error: any) {
      if (
        error?.type === "cancelation" ||
        error?.message?.includes("canceled")
      ) {
        console.log("AI request was canceled or aborted.");
        setIsProcessing(false);
        return;
      }
      console.error("Error generating response:", error);
      setSteps([
        {
          spokenText: "Sorry, an error occurred while processing your request.",
          whiteboardText: "Error.",
        },
      ]);
      setIsProcessing(false);
    }
  };
```

### 3. Also Remove Diagram Generation Fallback

Line ~579:
```typescript
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
```

This is used for diagram generation and also needs to be removed or moved to AWS.

## Recommended Approach

Since the Classroom.tsx file is very large (~1888 lines) and complex, I recommend a careful approach:

### Option A: Minimal Change (Safest)
Just replace the fallback with an error message:

```typescript
} catch (awsError) {
  console.error('❌ AWS Lambda unavailable:', awsError);
  
  // Show error to user
  setMessages((prev) => [
    ...prev,
    { role: "ai", text: "I'm sorry, the AI service is temporarily unavailable. Please try again in a moment." }
  ]);
  
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(
      "I'm sorry, the AI service is temporarily unavailable. Please try again in a moment."
    );
    window.speechSynthesis.speak(utterance);
  }
  
  setIsProcessing(false);
  return;
}
```

### Option B: Complete Rewrite (Better but Riskier)
Rewrite the entire `handleSendMessage` function to be AWS-only with proper error handling.

## Let Me Do It

I can make these changes for you. Would you like me to:

1. **Quick fix**: Just replace fallback with error message (5 minutes, low risk)
2. **Complete fix**: Rewrite to be AWS-only with better structure (15 minutes, medium risk)
3. **Manual**: I'll give you the exact lines to change and you do it

Which approach do you prefer?
