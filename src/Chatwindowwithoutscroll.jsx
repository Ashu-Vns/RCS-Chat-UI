import React, { useEffect, useRef } from "react";

function Chatwindow({ chatHistory, selectedNumber, fetchChat, fetchedLength, offset, loggedInUser, selectedBot }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (offset === 0) {
      // ✅ Fresh load: scroll to bottom
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      // ✅ Load more: preserve visible position
      const prevScrollHeight = el.scrollHeight;

      // Use a short delay to allow DOM updates
      requestAnimationFrame(() => {
        const newScrollHeight = el.scrollHeight;
        el.scrollTop = newScrollHeight - prevScrollHeight + el.scrollTop;
      });
    }
  }, [chatHistory, offset, fetchedLength]);

  const formatReadable = (timestamp) => {
        let date;
        if (timestamp.includes("T") && timestamp.endsWith("Z")) {
            date = new Date(timestamp);
        } else {
            const [datePart, timePart] = timestamp.split(" ");
            if (!timePart) return timestamp;
            const milliseconds = timePart.includes(".") ? timePart.split(".")[1].slice(0, 3) : "000";
            date = new Date(`${datePart}T${timePart.split(".")[0]}.${milliseconds}Z`);
        }

        if (isNaN(date)) return timestamp;
        return date.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4 transition-all duration-150"
    >
      {chatHistory.map((element, index) => {
        if (element?.type === "loadMore" && fetchedLength >= 20) {
          return (
            <div key={index} className="flex justify-center p-4">
              <button
                type="button"
                onClick={() => fetchChat(selectedNumber.replace("+", ""), selectedBot, true)}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105"
              >
                Load more messages
              </button>
            </div>
          );
        }

        // ---- OUTBOX ----
        if (element?.type?.toUpperCase() === "OUTBOX") {
          return (
            <div key={index} className="mb-6 flex justify-end items-end gap-2">
              <div className="max-w-[70%]">
                <div className="text-xs text-gray-500 mb-1 text-right">{formatReadable(element.time)}</div>
                <div className="bg-blue-500 text-white px-4 py-3 rounded-2xl rounded-br-none shadow-lg break-words">
                  {element.text}
                </div>
              </div>
              <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                {loggedInUser.substring(0, 1).toUpperCase()}
              </div>
            </div>
          );
        }

        // ---- INBOX ----
        if (element?.type?.toUpperCase() === "INBOX") {
          return (
            <div key={index} className="mb-6 flex justify-start items-end gap-2">
              <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                {selectedNumber.replace("+", "").substring(0, 2)}
              </div>
              <div className="max-w-[70%]">
                <div className="text-xs text-gray-500 mb-1">{formatReadable(element.time)}</div>
                <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-none shadow-md border border-gray-300 break-words">
                  {element.text}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

export default React.memo(Chatwindow);
