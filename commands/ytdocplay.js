const fs = require("fs");
const axios = require("axios");
const yts = require("yt-search");
const path = require("path");
const os = require("os");

const { createFakeContact } = require('../lib/fakeContact');
async function ytdocplayCommand(sock, chatId, message) {
    try { 
        await sock.sendMessage(chatId, {
            react: { text: "🎼", key: message.key }
        });
        
        // Use a safe temp directory
        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        } else {
            const stat = fs.statSync(tempDir);
            if (!stat.isDirectory()) {
                fs.unlinkSync(tempDir); // remove file named "temp"
                fs.mkdirSync(tempDir, { recursive: true });
            }
        }
        
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text;
        const parts = text.split(" ");
        const query = parts.slice(1).join(" ").trim();

        if (!query) {
            return await sock.sendMessage(chatId, { 
                text: "🎵 Provide a song name!\nExample: .play Awungazi" 
            }, { quoted: createFakeContact(message) });
        }

        if (query.length > 100) {
            return await sock.sendMessage(chatId, { 
                text: "📝zita resong rakanyanya kukurisa/ibizo lengoma elikhulu kakhulu! Max 100 chars." 
            }, { quoted: createFakeContact(message) });
        }

        const searchResult = await (await yts(`${query} official`)).videos[0];
        if (!searchResult) {
            return sock.sendMessage(chatId, { 
                text: "😕 Ndatadza kuwana song. Ndine chikumbiro zama muchikamu chinotevera/ ngiyehlulekile ukuthola ingoma. ngiyacela ukuzama futhi.!" 
            }, { quoted: createFakeContact(message) });
        }

        const video = searchResult;
        
        let downloadUrl;
        let videoTitle;
        
        const apis = [
            `https://apiskeith.top/download/audio?url=${encodeURIComponent(video.url)}`,
            `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(video.url)}`,
            `https://api.giftedtech.co.ke/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(video.url)}`
        ];
        
        for (const api of apis) {
            try {
                const response = await axios.get(api, { timeout: 30000 });
                
                if (api.includes("apiskeith")) {
                    if (response.data?.status && response.data?.result) {
                        downloadUrl = response.data.result;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes("ryzendesu")) {
                    if (response.data?.status && response.data?.url) {
                        downloadUrl = response.data.url;
                        videoTitle = response.data.title || video.title;
                        break;
                    }
                } else if (api.includes("gifted")) {
                    if (response.data?.status && response.data?.result?.download_url) {
                        downloadUrl = response.data.result.download_url;
                        videoTitle = response.data.result.title || video.title;
                        break;
                    }
                }
            } catch {
                continue; // try next API
            }
        }
        
        if (!downloadUrl) throw new Error("All download APIs failed. Ukuzama futhi yonke.");

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        const audioResponse = await axios({ 
            method: "get", 
            url: downloadUrl, 
            responseType: "stream", 
            timeout: 900000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        
        const writer = fs.createWriteStream(filePath);
        audioResponse.data.pipe(writer);
        await new Promise((resolve, reject) => { 
            writer.on("finish", resolve); 
            writer.on("error", reject); 
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error("Ndatadza kudownloader kana muFaira hamuna chiripo/ngiyehlulekile ukudownloader noma kufile akula lutho.!");
        }
        
        // Send audio as document
        await sock.sendMessage(chatId, { 
            document: { url: filePath }, 
            mimetype: "audio/mpeg", 
            fileName: `${(videoTitle || video.title).substring(0, 100)}.mp3`
        }, { quoted: createFakeContact(message) });

        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    } catch (error) {
        console.error("ytdocplayCommand error:", error);
        return await sock.sendMessage(chatId, { 
            text: `🚫 Error: ${error.message || "Ngiyehlulekile ukudownloader audio"}` 
        }, { quoted: createFakeContact(message) });
    }
}

module.exports = ytdocplayCommand;
