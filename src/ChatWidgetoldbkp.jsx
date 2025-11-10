import axios from "axios";
import React, { useState, useEffect, useCallback } from "react";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
// import { io } from "socket.io-client"

export default function ChatWidget() {
    // ----- state -----
    const [loggedInUser, setLoggedInUser] = useState("ajay@sms24hour.com");
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [selectedBot, setSelectedBot] = useState("");
    const [selectedNumber, setSelectedNumber] = useState("");
    const [filteredNumbers, setFilteredNumbers] = useState([]);
    const [chatHistory, setchatHistory] = useState([{ type: 'loadMore', status: false }])
    // const [chatHistory, setchatHistory] = useState([])
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);
    const [botList, setBotList] = useState([]);
    const [socket, setSocket] = useState(null)
    const [retryCount, setRetryCount] = useState(0);
    const [offset, setoffset] = useState(0)
    const [fetchedLength, setfetchedLength] = useState(0)
    const MAX_RETRIES = 10;
    const RETRY_DELAY = 3000;

    // loading states
    const [completeLoading, setCompleteLoading] = useState(false);
    const [isChatListLoading, setIsChatListLoading] = useState(false);
    const [botSelectionIsLoading, setBotSelectionIsLoading] = useState(false);
    const [sendButtonLoading, setsendButtonLoading] = useState(false)

    // ----- API calls -----
    const getLoggedInUser = useCallback(async () => {
        setCompleteLoading(true);
        try {
            // GET with config (withCredentials) as second argument
            const { data } = await axios.get(
                "http://111.118.177.68:8021/RCS_demo_5/SendUsername",
                { withCredentials: true }
            );
            if (data && data.username) setLoggedInUser(data.username);
        } catch (err) {
            console.error("getLoggedInUser error:", err);
        } finally {
            setCompleteLoading(false);
        }
    }, []);

    const getBotLists = useCallback(
        async (user) => {
            if (!user) return;
            setBotSelectionIsLoading(true);
            try {
                // Some APIs expect user as query param; change to body if API expects JSON body
                const { data } = await axios.post(
                    "https://chatapi.virtuosorbm.com/getBotList",
                    null,
                    { params: { user }, withCredentials: true }
                );
                setBotList(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("getBotLists error:", err);
                setBotList([]);
            } finally {
                setBotSelectionIsLoading(false);
            }
        },
        []
    );

    const getNumbers = useCallback(async (botId) => {
        if (!botId) {
            setFilteredNumbers([]);
            return;
        }
        setIsChatListLoading(true);
        try {
            // Send BotId as query param; if your API expects body, change null -> { BotId: botId }
            const { data } = await axios.post(
                "https://chatapi.virtuosorbm.com/getmsisdn",
                null,
                { params: { BotId: botId }, withCredentials: true }
            );
            setFilteredNumbers(Array.isArray(data) ? data : []);
            setCurrentPage(1);
            setSelectedNumber("");
        } catch (err) {
            console.error("getNumbers error:", err);
            setFilteredNumbers([]);
        } finally {
            setIsChatListLoading(false);
        }
    }, []);

    const fetchChat = useCallback(async (number, botId, offsetHit) => {
        if (offsetHit) {
            setoffset(prev => prev + 20);
        }

        if (!number || !botId) {
            setchatHistory([]);
            return;
        }

        try {
            const newOffset = offsetHit ? offset + 20 : 0;

            const { data } = await axios.post(
                "https://chatapi.virtuosorbm.com/getResponse",
                null,
                {
                    params: { BotId: botId, msisdn: number, offset: newOffset },
                    withCredentials: true
                }
            );

            setfetchedLength(data.length);

            setchatHistory(prevData => {
                if (offsetHit) {
                    return [prevData[0], ...data.reverse(), ...prevData.slice(1)];
                } else {
                    return [prevData[0], ...data.reverse()];
                }
            });
        } catch (err) {
            console.error("fetchChat error:", err);
            setchatHistory([]);
        }
    }, [offset]);


    // ----- effects -----
    useEffect(() => {
        getLoggedInUser();
    }, [getLoggedInUser]);

    useEffect(() => {
        if (loggedInUser) getBotLists(loggedInUser);
    }, [loggedInUser, getBotLists]);

    useEffect(() => {
        if (selectedBot) {
            offset > 0 ? setoffset(0) : null
            getNumbers(selectedBot);
        } else {
            setFilteredNumbers([]);
            setCurrentPage(1);
            setSelectedNumber("");
        }
    }, [selectedBot, getNumbers]);

    useEffect(() => {
        if (selectedNumber) {
            offset > 0 ? setoffset(0) : null
            fetchChat(selectedNumber.replace('+', ''), selectedBot, false)
        }
    }, [selectedNumber])



    // connect socket and register 
    useEffect(() => {
        if (!selectedBot) return;

        // Cleanup previous socket
        if (socket) {
            socket.disconnect();
            setSocket(null);
        }

        let newSocket;
        let retryAttempts = 0;
        let retryTimeout;

        const connectSocket = () => {
            console.log(`🔌 Attempting to connect... (try ${retryAttempts + 1}/${MAX_RETRIES})`);

            newSocket = io("http://111.118.177.68:5177", {
                transports: ["websocket"],
                query: { botId: selectedBot },
                reconnection: false, // we'll handle reconnection manually
            });

            newSocket.on("connect", () => {
                console.log(`✅ Connected to socket for bot ${selectedBot}`);
                setRetryCount(0);
                retryAttempts = 0;
                newSocket.emit("register", selectedBot);
            });

            newSocket.on("connect_error", (err) => {
                console.error("⚠️ Connection error:", err.message);
                if (selectedBot && retryAttempts < MAX_RETRIES) {
                    retryAttempts++;
                    setRetryCount(retryAttempts);
                    retryTimeout = setTimeout(connectSocket, RETRY_DELAY);
                } else {
                    console.error("❌ Max retries reached. Could not connect to socket.");
                }
            });

            newSocket.on("disconnect", (reason) => {
                console.warn(`❌ Disconnected (${reason})`);
                if (selectedBot && retryAttempts < MAX_RETRIES) {
                    retryAttempts++;
                    setRetryCount(retryAttempts);
                    retryTimeout = setTimeout(connectSocket, RETRY_DELAY);
                } else {
                    console.error("❌ Max retries reached. Giving up reconnection.");
                }
            });

            newSocket.on("new_message", (data) => {
                console.log("📩 New message:", data);
            });

            // newSocket.on("send_message", () => {
            //     console.log("📩 New message:", data);
            // });

            setSocket(newSocket);
        };

        connectSocket();

        // Cleanup on unmount or bot change
        return () => {
            console.log("🧹 Cleaning up socket...");
            if (retryTimeout) clearTimeout(retryTimeout);
            if (newSocket) newSocket.disconnect();
        };
    }, [selectedBot]);


    const formatReadable = (timestamp) => {
        let date;

        // Try ISO format first
        if (timestamp.includes('T') && timestamp.endsWith('Z')) {
            date = new Date(timestamp);
        } else {
            // Handle custom format "YYYY-MM-DD HH:mm:ss.SSSSSS"
            // Replace space with 'T' and truncate microseconds to milliseconds
            const [datePart, timePart] = timestamp.split(' ');
            if (!timePart) return timestamp; // fallback if format unexpected

            // Take only first 3 digits of microseconds for milliseconds
            const milliseconds = timePart.includes('.')
                ? timePart.split('.')[1].slice(0, 3)
                : '000';

            date = new Date(`${datePart}T${timePart.split('.')[0]}.${milliseconds}Z`);
        }

        if (isNaN(date)) return timestamp; // fallback if parsing fails

        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        };

        return date.toLocaleString('en-US', options);
    };
    // ----- helpers -----
    const totalPages = Math.max(1, Math.ceil(filteredNumbers.length / itemsPerPage));
    const pageItems = filteredNumbers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const sendMessage = async (e) => {
        setsendButtonLoading(true)
        e.preventDefault();
        const text = input.trim();
        if (!text || !socket || !selectedNumber) return;

        try {

            const payload = {
                senderPhoneNumber: selectedNumber,
                BotId: selectedBot,
                supplier: "Jio",
                text: text,
            };

            console.log("📤 Sending message:", payload);

            // 🕓 Wait for server acknowledgment
            const ack = await new Promise((resolve, reject) => {
                socket.emit("send_message", JSON.stringify(payload), (ackData) => {
                    resolve(ackData);
                });

                // Optional timeout if server never replies (10 seconds)
                // setTimeout(() => reject(new Error("Server did not respond in time")), 10000);
            });

            const finalack = JSON.parse(ack);

            // 🧪 Optional test delay (e.g., simulate slow network)
            await new Promise((res) => setTimeout(res, 2000));

            if (finalack?.success) {
                // 🕒 Current timestamp in ISO format
                const sendTime = new Date().toISOString();

                // ✅ Push sent message into chatHistory
                const newChatMessage = {
                    BotId: selectedBot,
                    messageId: `msg_${Date.now()}`, // temp ID
                    message_type: "TEXT",
                    time: sendTime,
                    senderPhoneNumber: selectedNumber,
                    supplier: "Jio",
                    text: text,
                    type: "outbox",
                };

                setchatHistory((prev) => [...prev, newChatMessage]);
                setInput("");
            } else {
                alert(finalack?.error || "Something went wrong");
                setInput("");
            }
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message or no acknowledgment from server.");
            setInput("");
        } finally {
            setsendButtonLoading(false)
        }
    };


    // ----- small inline styles for reactjs-popup -----
    const overlayStyle = {
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
    };

    const contentStyle = {
        width: "80vw",
        maxWidth: "1200px",
        height: "80vh",
        borderRadius: "12px",
        padding: 0,
        overflow: "hidden",
        boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
        border: "none",
        WebkitOverflowScrolling: "touch",
        willChange: "transform, opacity",
    };

    // ----- render -----
    return (
        <>
            <Popup
                trigger={<button className="cursor-pointer">Live Chat</button>}
                modal
                nested
                closeOnDocumentClick={false}
                lockScroll={true}
                overlayStyle={overlayStyle}
                contentStyle={contentStyle}
                overlayClassName="custom-popup-overlay"
                className="custom-popup-content"
            >
                {(close) =>
                    completeLoading ? (
                        <div className="w-full h-full flex items-center justify-center p-6">
                            {/* spinner svg (full path strings) */}
                            <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                        </div>
                    ) : (
                        <div className="h-full w-full flex flex-col md:flex-row bg-white">
                            {/* Left List */}
                            <div
                                className={`w-full md:w-1/3 lg:w-1/4 bg-white border-r border-gray-200 ${selectedNumber ? "hidden md:block" : "block"} flex flex-col`}
                            >
                                <div className="p-4 bg-gray-50 border-b border-gray-200">
                                    {botSelectionIsLoading ? (
                                        <div className="w-full h-full flex items-center justify-center p-6">
                                            <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedBot}
                                            id="selectedBot"
                                            name="selectedBot"
                                            onChange={(e) => setSelectedBot(e.target.value)}
                                            className="w-full p-2 my-2 text-sm border border-gray-300 rounded-md focus:ring focus:ring-blue-300 focus:border-blue-500"
                                        >
                                            <option value="">--select bot--</option>
                                            {botList.map((bot, index) => (
                                                <option key={index} value={bot.botId}>
                                                    {bot.botName}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div
                                    className="overflow-y-auto flex-1"
                                    style={{ maxHeight: "calc(80vh - 72px)" }}
                                >
                                    {filteredNumbers.length !== 0 ? (
                                        <>
                                            {pageItems.map((element, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setSelectedNumber(element)}
                                                    className={`cursor-pointer w-full flex items-center p-3 text-left ${element === selectedNumber ? "bg-blue-50 border-l-4 border-blue-400" : "hover:bg-gray-100"}`}
                                                >
                                                    <div className="flex-shrink-0">
                                                        <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center font-medium text-blue-400">
                                                            {/* chat bubble icon (full path string) */}
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    <div className="ml-3 flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{element}</p>
                                                        <p className="text-xs text-gray-500 truncate">{element}</p>
                                                    </div>
                                                </button>
                                            ))}

                                            <div className="flex justify-between items-center p-3 border-t border-gray-200">
                                                <button
                                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                    disabled={currentPage === 1}
                                                    className={`px-3 py-1 rounded ${currentPage === 1 ? "text-gray-400 cursor-not-allowed" : "text-blue-400 hover:bg-gray-100"}`}
                                                >
                                                    Previous
                                                </button>

                                                <div className="text-xs text-gray-500">Page {currentPage} / {totalPages}</div>

                                                <button
                                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                    className={`px-3 py-1 rounded ${currentPage === totalPages ? "text-gray-400 cursor-not-allowed" : "text-blue-400 hover:bg-gray-100"}`}
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </>
                                    ) : isChatListLoading ? (
                                        <div className="w-full h-full flex items-center justify-center p-6">
                                            <svg aria-hidden="true" className="w-8 h-8 text-gray-200 animate-spin fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-gray-500 text-sm">No conversations yet.</div>
                                    )}
                                </div>
                            </div>

                            {/* Chat Window */}
                            {selectedNumber ? (
                                <div className="flex-1 flex flex-col bg-white overflow-hidden">
                                    <div className="p-4 border-b border-gray-200 bg-white flex items-center">
                                        <button onClick={() => setSelectedNumber("")} className="md:hidden mr-2 p-2 hover:bg-gray-100 rounded-full">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex-shrink-0">
                                                    <div className="w-10 h-10 rounded-full bg-blue-400/20 flex items-center justify-center font-medium text-blue-400">{selectedNumber.replace('+', '').substring(0, 2)}</div>
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-semibold text-gray-900">{selectedNumber}</h2>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Messages Container */}
                                    <div
                                        ref={(el) => el && (offset === 0 ? el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) : el.children[fetchedLength]?.scrollIntoView({ behavior: 'auto' }))}
                                        className="flex-1 overflow-y-auto p-4 overflow-auto bg-gray-50 space-y-4"
                                    >
                                        <div ref={(el) => el && (offset === 0 ? el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) : el.children[fetchedLength] && el.children[fetchedLength].scrollIntoView({ behavior: 'auto' }))}
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
                                                                    Y
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
                                    </div>

                                    <div className="p-4 border-t border-gray-200 bg-white">
                                        <form onSubmit={sendMessage} className="flex items-center gap-3">
                                            <input
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                placeholder="Type your message..."
                                                className="transition-all flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-blue-400"
                                            />

                                            <button type="submit" disabled={!input || sendButtonLoading} className={`${!input ? "cursor-not-allowed" : "cursor-pointer hover:bg-green-500 hover:w-20 hover:justify-center hover:text-white text-blue-500"} transition-all overflow-hidden w-10 flex items-center justify-end  py-1 px-1 rounded`}>
                                                {input ? <span className="transition-all w-0 translate-x-16 group-hover:w-auto group-hover:visible invisible group-hover:translate-x-0">Send</span> : null}
                                                {/* send icon (full path string) */}
                                                {sendButtonLoading ? <svg aria-hidden="true" className="w-4 h-4 text-green-500 animate-spin dark:text-gray-600 fill-white" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" /><path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                                                </svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`transition-all size-6 ${input ? "group-hover:ml-1 group-hover:size-5" : null}`}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                                </svg>}


                                            </button>

                                            <button type="button" onClick={close} className="flex justify-center items-center transition-all px-4 py-1 text-sm text-red-500 border border-red-500 hover:bg-red-500 hover:text-white rounded group">Close
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-0 transition-all group-hover:size-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 w-full h-full flex justify-center items-center">Please Select any number to view the chat</div>
                            )}
                        </div>
                    )
                }
            </Popup >

            {/* CSS helpers for reactjs-popup */}
            < style > {`
        /* overlay fade in */
        .custom-popup-overlay { animation: customOverlayFade 220ms ease forwards; }
        @keyframes customOverlayFade { from { opacity: 0; transform: scale(0.995); } to { opacity: 1; transform: scale(1); } }

        /* content pop-in */
        .custom-popup-content { border-radius: 12px; animation: customContentPop 260ms cubic-bezier(.2,.9,.35,1) forwards; transform-origin: center; }
        @keyframes customContentPop { 0% { opacity: 0; transform: translateY(10px) scale(0.985); } 60% { opacity: 1; transform: translateY(-6px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }

        /* small responsive fix for very small screens */
        @media (max-width: 520px) { .custom-popup-content { width: 95vw !important; height: 90vh !important; } }
      `}</style >
        </>
    );
}
