import React from 'react'

function Chatwindow({ chatHistory, selectedNumber, fetchChat, fetchedLength, offset, loggedInUser, selectedBot, ifNew }) {
    // ----- Format timestamp -----
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
        <div ref={(el) => el && (offset === 0  || ifNew ? el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })  : el.children[fetchedLength] && el.children[fetchedLength].scrollIntoView({ behavior: 'auto' }))}
            className="p-4 bg-gray-50 overflow-y-auto h-full">
            {selectedNumber && chatHistory.length > 0 ?
                chatHistory.map((element, index) => {
                    const finalElement = element
                    // console.log(finalElement)
                    if (finalElement?.type === "loadMore" && fetchedLength >= 20) {
                        return (<div key={index} className="flex justify-center p-4">
                            <button
                                onClick={() => { fetchChat(selectedNumber.replace('+', ''), selectedBot, true) }}
                                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105"
                            >
                                Load more messages
                            </button>
                        </div>)
                    } else if (finalElement?.type?.toUpperCase() === "OUTBOX") {
                        return (
                            <div className="mb-6 flex justify-end items-end gap-2 group" key={index}>
                                <div className="max-w-[70%]">
                                    <div className="text-xs text-gray-500 mb-1 text-right">
                                        {formatReadable(finalElement.time)}
                                    </div>
                                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-2xl rounded-br-none shadow-lg">
                                        {finalElement.text}
                                    </div>
                                </div>
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                                    {loggedInUser.replace('+', '').substring(0, 1).toUpperCase()}
                                </div>
                            </div>
                        )
                    } else if (finalElement?.type?.toUpperCase() === "INBOX") {
                        return (
                            <div className="mb-6 flex justify-start items-end gap-2 group" key={index}>
                                <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md">
                                    {selectedNumber.replace('+', '').substring(0, 2)}
                                </div>
                                <div className="max-w-[70%]">
                                    <div className="text-xs text-gray-500 mb-1">
                                        {formatReadable(finalElement.time)}
                                    </div>
                                    <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-none shadow-md border border-gray-300">
                                        {finalElement.text}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                })
                : null}
        </div>
    )
}

export default React.memo(Chatwindow)