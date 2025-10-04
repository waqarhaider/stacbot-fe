import React, { useEffect, useState, useRef } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // "chat" or "feedback"
  const chatEndRef = useRef(null);
  const initialRender = useRef(true); // track first render

  // Feedback fields
  const [feedbackQuestion, setFeedbackQuestion] = useState("");
  const [feedbackAnswer, setFeedbackAnswer] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  // Load chat history from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    setChatHistory(saved);
  }, []);

  // Scroll to bottom on new messages, but skip initial render
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return; // skip scrolling on first load
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveChat = (id, updatedMessages) => {
    const title = updatedMessages[0]?.content?.slice
      ? updatedMessages[0]?.content.slice(0, 20)
      : `Chat ${id}`;
    const newChat = {
      id,
      title,
      messages: updatedMessages,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...chatHistory.filter((c) => c.id !== id), newChat];
    setChatHistory(updatedHistory);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
  };

  const createNewChat = () => {
    if (messages.length > 0 && currentChatId) {
      saveChat(currentChatId, messages);
    }
    const newId = Date.now().toString();
    setMessages([]);
    setCurrentChatId(newId);
  };

  const loadChat = (chat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
  };

  const deleteChat = (id) => {
    const updatedHistory = chatHistory.filter((chat) => chat.id !== id);
    setChatHistory(updatedHistory);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
    if (id === currentChatId) {
      createNewChat();
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const chatId = currentChatId || Date.now().toString();
    if (!currentChatId) setCurrentChatId(chatId);

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      let res;
      if (messages.length === 0) {
        res = await fetch("https://stacbot-be.onrender.com/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: input }),
        });
      } else {
        const previous_user_msg = messages.find(
          (m) => m.role === "user"
        )?.content;
        const previous_bot_msg = messages.find((m) => m.role === "bot")?.content
          ?.openai;

        res = await fetch("https://stacbot-be.onrender.com/chat_feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_feedback: input,
            previous_question: previous_user_msg || null,
            previous_answer: previous_bot_msg || null,
          }),
        });
      }

      const data = await res.json();

      const clean = (text) => {
        if (!text || typeof text !== "string") return "";
        const unknownPhrases = [
          "i don't know",
          "i do not know",
          "no relevant information",
          "couldn't find",
          "not found",
          "don't have the answer",
        ];
        return unknownPhrases.some((p) => text.toLowerCase().includes(p))
          ? "I wish I could help with that, but I don’t have the answer to that right now based on context provided."
          : text.trim();
      };

      const openai = clean(
        messages.length === 0 ? data.openai_answer : data.updated_answer
      );

      const reply = {
        role: "bot",
        content: { openai },
        sources: {
          openai:
            messages.length === 0
              ? data.openai_sources || []
              : data.feedback_context_sources || [],
        },
        feedbacks: data.matched_feedbacks || [],
      };

      const updatedMessages = [...newMessages, reply];
      setMessages(updatedMessages);
      saveChat(chatId, updatedMessages);
    } catch (e) {
      console.error("Failed to fetch:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  const saveFeedback = async () => {
    if (!feedbackQuestion || !feedbackText) {
      setFeedbackStatus("Please fill all required fields");
      return;
    }
    setFeedbackStatus("Saving feedback...");
    try {
      const res = await fetch(
        "https://stacbot-be.onrender.com/save_offline_feedback",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_asked: feedbackQuestion,
            answer_received: feedbackAnswer,
            helpful_feedback: feedbackText,
          }),
        }
      );

      const data = await res.json();
      if (data.status === "success") {
        setFeedbackStatus("Feedback saved successfully!");
        setFeedbackQuestion("");
        setFeedbackAnswer("");
        setFeedbackText("");
      } else {
        setFeedbackStatus("Failed to save feedback");
      }
    } catch (e) {
      console.error(e);
      setFeedbackStatus("Error saving feedback");
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="app-logo">
            <img src="logo.png" alt="STAC Logo" />
            <span className="chatbot-text">ChatBot</span>
          </div>

          <button className="new-chat" onClick={createNewChat}>
            ＋
          </button>
        </div>

        <div className="tab-buttons">
          <button
            className={activeTab === "chat" ? "active" : ""}
            onClick={() => setActiveTab("chat")}
          >
            Chat
          </button>
          <button
            className={activeTab === "feedback" ? "active" : ""}
            onClick={() => setActiveTab("feedback")}
          >
            Offline Feedback
          </button>
        </div>

        {activeTab === "chat" && (
          <div className="chat-history">
            <h5 className="chat-history-title">🕘 Chat History</h5>
            {chatHistory
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((chat) => (
                <div
                  key={chat.id}
                  className={`history-item ${
                    chat.id === currentChatId ? "active" : ""
                  }`}
                >
                  <div
                    style={{ cursor: "pointer", flex: 1 }}
                    onClick={() => loadChat(chat)}
                  >
                    <div className="chat-title">🗂 {chat.title}</div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    style={{
                      cursor: "pointer",
                      color: "#ef4444",
                      paddingLeft: "0.5rem",
                    }}
                    title="Delete chat"
                  >
                    🗑️
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="chat-main">
        {activeTab === "chat" ? (
          <>
            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message ${msg.role === "user" ? "user" : "bot"}`}
                >
                  <span className="avatar">
                    {msg.role === "user" ? "🧑" : "🤖"}
                  </span>
                  <div className="message-content">
                    {typeof msg.content === "string" ? (
                      <div className="text" style={{ whiteSpace: "pre-wrap" }}>
                        {msg.content}
                      </div>
                    ) : (
                      <div className="dual-response">
                        <div className="model-response">
                          <div className="model-label">🟢 OpenAI</div>
                          <div
                            className="text"
                            style={{ whiteSpace: "pre-wrap" }}
                          >
                            {msg.content.openai}
                          </div>
                          {msg.sources?.openai &&
                            msg.sources.openai.length > 0 && (
                              <Sources sources={msg.sources.openai} />
                            )}
                          {msg.feedbacks && msg.feedbacks.length > 0 && (
                            <Feedbacks feedbacks={msg.feedbacks} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message bot">
                  <span className="avatar">🤖</span>
                  <div className="message-content">
                    <div
                      className="text"
                      style={{ fontStyle: "italic", color: "#666" }}
                    >
                      STACBot is thinking, Please wait ...
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
            <div className="input-area">
              <input
                type="text"
                placeholder="Ask something..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <OfflineFeedback
            question={feedbackQuestion}
            setQuestion={setFeedbackQuestion}
            answer={feedbackAnswer}
            setAnswer={setFeedbackAnswer}
            feedback={feedbackText}
            setFeedback={setFeedbackText}
            status={feedbackStatus}
            saveFeedback={saveFeedback}
          />
        )}
      </div>
    </div>
  );
}

function Sources({ sources }) {
  const [showAll, setShowAll] = React.useState(false);
  const previewLength = 300;

  const combinedContent = sources
    .map((src) => `${src.source}: ${src.content_excerpt}`)
    .join("\n\n");

  const previewContent = combinedContent.substring(0, previewLength);
  const toggleShowAll = () => setShowAll(!showAll);

  return (
    <div className="sources" style={{ marginTop: "12px" }}>
      <h5 style={{ marginBottom: "8px", display: "inline" }}>
        Sources:{" "}
        {combinedContent.length > previewLength && (
          <button
            onClick={toggleShowAll}
            style={{
              background: "none",
              border: "none",
              color: "#007bff",
              cursor: "pointer",
              padding: 0,
              fontSize: "1.1em",
              display: "inline",
            }}
          >
            {showAll ? "Show Less" : "Show More"}
          </button>
        )}
      </h5>
      <div
        style={{
          fontSize: "0.8rem",
          color: "#666",
          marginBottom: "8px",
          marginTop: "4px",
        }}
      >
        Total sources: {sources.length}
      </div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          maxHeight: showAll ? "none" : "150px",
          overflow: "hidden",
          background: "#f9f9f9",
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #ddd",
          marginTop: "4px",
        }}
      >
        {showAll
          ? combinedContent
          : previewContent +
            (combinedContent.length > previewLength ? "..." : "")}
      </pre>
    </div>
  );
}

function Feedbacks({ feedbacks }) {
  const [showAll, setShowAll] = React.useState(false);
  const previewLength = 300;

  const combinedFeedbacks = feedbacks
    .map(
      (fb, idx) =>
        `Feedback # ${idx + 1} (Score: ${fb.score?.toFixed(2) ?? "N/A"})\n` +
        `Question: ${fb.payload["question_asked"]}\n` +
        `Feedback: ${fb.payload["helpful_feedback"]}`
    )
    .join("\n\n");

  const previewContent = combinedFeedbacks.substring(0, previewLength);
  const toggleShowAll = () => setShowAll(!showAll);

  return (
    <div className="feedbacks" style={{ marginTop: "12px" }}>
      <h5 style={{ marginBottom: "8px", display: "inline" }}>
        Matched Offline Feedbacks:{" "}
        {combinedFeedbacks.length > previewLength && (
          <button
            onClick={toggleShowAll}
            style={{
              background: "none",
              border: "none",
              color: "#007bff",
              cursor: "pointer",
              padding: 0,
              fontSize: "1.1em",
              display: "inline",
            }}
          >
            {showAll ? "Show Less" : "Show More"}
          </button>
        )}
      </h5>
      <div
        style={{
          fontSize: "0.8rem",
          color: "#666",
          marginBottom: "8px",
          marginTop: "4px",
        }}
      >
        Total feedbacks: {feedbacks.length}
      </div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          maxHeight: showAll ? "none" : "150px",
          overflow: "hidden",
          background: "#f9f9f9",
          padding: "8px",
          borderRadius: "4px",
          border: "1px solid #ddd",
          marginTop: "4px",
        }}
      >
        {showAll
          ? combinedFeedbacks
          : previewContent +
            (combinedFeedbacks.length > previewLength ? "..." : "")}
      </pre>
    </div>
  );
}

function OfflineFeedback({
  question,
  setQuestion,
  answer,
  setAnswer,
  feedback,
  setFeedback,
  status,
  saveFeedback,
}) {
  return (
    <div className="offline-feedback">
      <h2>Offline Feedback</h2>
      <textarea
        placeholder="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={2}
      />
      <textarea
        placeholder="Helpful Feedback"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={4}
      />
      <textarea
        placeholder="Answer Received (Optional)"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
      />
      <button className="feedback-btn" onClick={saveFeedback}>
        Save Feedback
      </button>
      <div className="feedback-status">{status}</div>
    </div>
  );
}

export default App;
