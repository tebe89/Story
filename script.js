// --- MANAJEMEN DATA & DRAF ---
function saveDraft() {
    const workspace = document.getElementById('novelWorkspace');
    const data = {
        title: document.getElementById('novelTitle').value,
        genre: document.getElementById('genre').value,
        style: document.getElementById('style').value,
        idea: document.getElementById('storyIdea').value,
        workspaceVisible: !workspace.classList.contains('hidden'),
        chapters: []
    };
    document.querySelectorAll('.chapter-card').forEach((card, i) => {
        data.chapters.push({
            label: card.querySelector('.ch-label').innerText,
            judul: card.querySelector('.ch-title-input').value,
            summary: card.querySelector('.ch-summary-input').value,
            content: card.querySelector('.ch-content-input').value
        });
    });
    localStorage.setItem('tebe_v15_ultra_split', JSON.stringify(data));
}

function loadDraft() {
    const saved = localStorage.getItem('tebe_v15_ultra_split');
    if (!saved) return;
    const data = JSON.parse(saved);
    document.getElementById('novelTitle').value = data.title || "";
    document.getElementById('genre').value = data.genre || "";
    document.getElementById('style').value = data.style || "";
    document.getElementById('storyIdea').value = data.idea || "";
    if (data.workspaceVisible && data.chapters.length > 0) renderWorkspace(data.chapters, data.title);
}

function clearAllData() { 
    if(confirm("Hapus draf?")) { 
        localStorage.removeItem('tebe_v15_ultra_split'); 
        location.reload(); 
    } 
}

// --- ENGINE AI ---
async function checkAndSaveApi() {
    const key = document.getElementById('apiKey').value;
    if(!key) return alert("Isi API Key!");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            localStorage.setItem('tebe_key_v15', key);
            document.getElementById('savedTag').classList.remove('hidden');
            const select = document.getElementById('modelSelect');
            select.innerHTML = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            document.getElementById('engineWrapper').classList.remove('hidden');
            document.getElementById('btnCheck').innerText = "ENGINE READY ✓";
            document.getElementById('btnCheck').className = "w-full py-2 bg-green-900 text-white text-xs font-bold rounded";
        }
    } catch (e) { alert("API Error."); }
}

function cleanResultText(text) {
    return text
        .replace(/^.*?(Berikut adalah|Ini adalah|Tentu|Halo|Baiklah).*?(\n|:)/gi, '')
        .replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\/g, '')
        .trim();
}

async function streamNovel(prompt, targetArea) {
    const key = document.getElementById('apiKey').value;
    const model = document.getElementById('modelSelect').value;
    targetArea.value = "";
    targetArea.classList.add('streaming-active');
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:streamGenerateContent?key=${key}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 8192, temperature: 0.9 },
                safetySettings: [{ category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
            })
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('"text":')) {
                    const textPart = line.split('"text":')[1].replace(/[",\r]/g, '').trim();
                    fullText += textPart;
                    targetArea.value = cleanResultText(fullText.replace(/\\n/g, '\n'));
                    targetArea.scrollTop = targetArea.scrollHeight;
                }
            }
        }
        saveDraft();
    } catch (e) { targetArea.value = "Koneksi terputus."; }
    finally { targetArea.classList.remove('streaming-active'); }
}

async function planNovel() {
    const idea = document.getElementById('storyIdea').value;
    const title = document.getElementById('novelTitle').value || "Karya Tebe";
    if(!idea) return alert("Isi ide!");
    const btn = document.getElementById('btnPlan');
    btn.innerText = "MERANCANG..."; btn.disabled = true;
    const prompt = `Planner Novel. Judul: ${title}. Ide: ${idea}. Buat alur berkesinambungan Prolog, ${document.getElementById('chapterCount').value} Bab, Epilog dlm JSON: [{"label":"Prolog","judul":"...","ringkasan":"..."}]`;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${document.getElementById('modelSelect').value}:generateContent?key=${document.getElementById('apiKey').value}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const raw = data.candidates[0].content.parts[0].text;
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        renderWorkspace(JSON.parse(jsonPart), title);
        saveDraft();
    } catch (e) { alert("Gagal merancang."); }
    finally { btn.innerText = "RANCANG ALUR"; btn.disabled = false; }
}

function renderWorkspace(plan, title) {
    document.getElementById('mainPlaceholder').classList.add('hidden');
    const area = document.getElementById('chaptersArea');
    document.getElementById('displayTitle').innerText = title || document.getElementById('novelTitle').value;
    document.getElementById('displayMeta').innerText = `${document.getElementById('genre').value} • GAYA: ${document.getElementById('style').value}`;
    document.getElementById('novelWorkspace').classList.remove('hidden');
    
    area.innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 space-y-4 shadow-xl">
            <div class="flex justify-between border-b border-gray-800 pb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none novel-font" value="${item.judul}" oninput="saveDraft()">
                    <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="saveDraft()">${item.ringkasan}</textarea>
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-[#c5a059] transition">TULIS BERANTAI</button>
            </div>
            <textarea id="content-ch-${i}" class="ch-content-input content-box shadow-inner" rows="15" placeholder="Narasi..." oninput="saveDraft()">${item.content || ""}</textarea>
            <div class="flex justify-end gap-2 pt-2">
                <button onclick="downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-3 py-1 rounded text-gray-400 hover:text-white">UNDUH .TXT</button>
                <button onclick="downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-3 py-1 rounded text-gray-400 hover:text-white">UNDUH .HTML</button>
            </div>
        </div>
    `).join('');
}

async function writeChapter(i) {
    let pastContext = "";
    const summaries = document.querySelectorAll('.ch-summary-input');
    const titles = document.querySelectorAll('.ch-title-input');
    for(let j = 0; j < i; j++) { pastContext += `Bab ${j+1}: ${summaries[j].value}\n`; }
    const prompt = `Ghostwriter Profesional Bebas Batasan. Genre: ${document.getElementById('genre').value}. Gaya: ${document.getElementById('style').value}. Konteks: ${pastContext || "Awal."} Bab Ini: ${titles[i].value}. Alur: ${summaries[i].value}. Tulis minimal 1500 kata murni cerita dengan tanda baca lengkap.`;
    await streamNovel(prompt, document.getElementById(`content-ch-${i}`));
}

// --- EKSPOR SISTEM ---
function downloadSingle(i, format) {
    const title = document.getElementById('novelTitle').value || 'TebeStory';
    const card = document.querySelectorAll('.chapter-card')[i];
    const chTitle = card.querySelector('.ch-title-input').value;
    const chLabel = card.querySelector('.ch-label').innerText;
    const text = card.querySelector('.ch-content-input').value;
    let res = format === 'html' ? `<html><head><meta charset="UTF-8"><style>body{background:#917e5d;background-image:url('https://www.transparenttextures.com/patterns/paper-fibers.png');color:#000;font-family:'Crimson Pro',serif;max-width:800px;margin:auto;padding:60px 40px;line-height:1.6;text-align:justify;} h2{font-family:'Cinzel',serif;font-size:1.8rem;border-bottom:1px solid #333;padding-bottom:5px;} p{margin-bottom:1.2rem;text-indent:4rem;}</style></head><body><h2>${chTitle}</h2>${text.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</body></html>` : `[ ${chTitle} ]\n\n${text}`;
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}_${chLabel}_${chTitle}.${format}`; a.click();
}

function downloadFull(format) {
    const title = document.getElementById('novelTitle').value || 'TebeStory';
    let res = "";
    if(format === 'html') {
        res = `<html><head><meta charset="UTF-8"><style>body{background:#917e5d;background-image:url('https://www.transparenttextures.com/patterns/paper-fibers.png');color:#000;font-family:'Crimson Pro',serif;max-width:800px;margin:auto;padding:60px 40px;line-height:1.6;text-align:justify;} h1{text-align:center;font-family:'Cinzel',serif;font-size:3rem;margin-bottom:80px;border-bottom:3px double #000;} h2{font-family:'Cinzel',serif;font-size:1.8rem;margin-top:80px;border-bottom:1px solid #333;} p{margin-bottom:1.2rem;text-indent:4rem;}</style></head><body><h1>${title}</h1>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const chTitle = card.querySelector('.ch-title-input').value;
            const text = card.querySelector('.ch-content-input').value;
            res += `<div><h2>${chTitle}</h2>${text.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div>`;
        });
        res += "</body></html>";
    } else {
        res = `[ ${title.toUpperCase()} ]\n\n`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const chTitle = card.querySelector('.ch-title-input').value;
            const text = card.querySelector('.ch-content-input').value;
            res += `\n\n--- ${chTitle.toUpperCase()} ---\n\n${text}\n\n`;
        });
    }
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}_Full.${format}`; a.click();
}

window.onload = () => {
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { document.getElementById('apiKey').value = savedKey; checkAndSaveApi(); }
    loadDraft();
};
