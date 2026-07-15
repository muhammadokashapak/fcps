// GLOBAL STATE (Using questions.js bankData)
let userData = {
    stats: { attempted: 0, correct: 0, incorrect: 0 },
    history: [],
    seenMap: {},
    mistakesBank: [] // Array of { qId, questionText, category, wrongOption, correctOption, explanation }
};

// DOM Elements
const screens = {
    user: document.getElementById('user-screen'),
    quiz: document.getElementById('quiz-screen'),
    res: document.getElementById('res-screen')
};

function switchScreen(scr) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[scr].classList.add('active');
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Load local storage data
    const saved = localStorage.getItem('fcps_guest_user');
    if (saved) {
        userData = JSON.parse(saved);
        if(!userData.mistakesBank) userData.mistakesBank = [];
    } else {
        saveProgress();
    }
    initUser();
});

function saveProgress() {
    localStorage.setItem('fcps_guest_user', JSON.stringify(userData));
}

// ==========================================
// USER PORTAL
// ==========================================
function initUser() {
    document.getElementById('user-attempted-mcqs').innerText = userData.stats.attempted;
    const acc = userData.stats.attempted > 0 ? Math.round((userData.stats.correct / userData.stats.attempted)*100) : 0;
    document.getElementById('user-accuracy').innerText = acc + "%";
    document.getElementById('analytic-accuracy').innerText = acc + "%";
    
    // Ensure bankData exists from questions.js
    const seenCount = Object.keys(userData.seenMap).length;
    document.getElementById('user-unseen-mcqs').innerText = Math.max(0, (window.bankData ? window.bankData.length : 0) - seenCount);

    switchUserTab('dash', document.querySelectorAll('.nav-link')[0]);
    switchScreen('user');
}

function switchUserTab(tabId, el) {
    document.querySelectorAll('.user-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-menu .nav-link').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
    
    const titles = { dash: 'Dashboard', qbank: 'Question Bank', analytics: 'Analytics', mistakes: 'Review Mistakes' };
    document.getElementById('topbar-title').innerText = titles[tabId];
    
    if(tabId === 'mistakes') renderMistakes();
}

async function resetUserProgress() {
    if(confirm("Are you sure you want to delete all your history and mistakes?")) {
        userData = { stats: { attempted: 0, correct: 0, incorrect: 0 }, history: [], seenMap: {}, mistakesBank: [] };
        saveProgress();
        initUser();
    }
}

// ==========================================
// MISTAKES BANK
// ==========================================
function renderMistakes() {
    const container = document.getElementById('mistakes-container');
    container.innerHTML = '';
    
    if(userData.mistakesBank.length === 0) {
        container.innerHTML = '<p class="text-muted">You have no recorded mistakes. Great job!</p>';
        return;
    }
    
    userData.mistakesBank.forEach((m, idx) => {
        const div = document.createElement('div');
        div.className = 'mistake-card mb-4 p-4 border rounded';
        div.style.backgroundColor = '#fef2f2'; // light red tint
        div.style.borderColor = '#fca5a5';
        
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <span class="badge bg-danger mb-2">Mistake #${idx + 1}</span>
            </div>
            <p><strong>Question:</strong> ${m.questionText}</p>
            <p class="text-danger"><strong>Your Answer:</strong> ${m.wrongOption}</p>
            <p class="text-success"><strong>Correct Answer:</strong> ${m.correctOption}</p>
            <hr>
            <p><strong>Explanation:</strong><br>${m.explanation}</p>
        `;
        container.appendChild(div);
    });
}

function clearMistakes() {
    if(confirm("Are you sure you want to clear your Mistakes Bank?")) {
        userData.mistakesBank = [];
        saveProgress();
        renderMistakes();
    }
}

// ==========================================
// QUIZ ENGINE (Immersive Mode + Anti-Cheat)
// ==========================================
let quizState = {
    paper: [], currentIndex: 0, answers: {}, flags: {}, 
    timerInt: null, timeLeft: 0, isReview: false, mode: 0, penaltiesApplied: 0
};

// Anti-Cheat Mechanisms
document.addEventListener("visibilitychange", () => {
    if(screens.quiz.classList.contains('active') && !quizState.isReview && document.visibilityState === 'hidden') {
        applyCheatingPenalty();
    }
});
screens.quiz.addEventListener("contextmenu", e => { if(!quizState.isReview) e.preventDefault(); });
screens.quiz.addEventListener("copy", e => { if(!quizState.isReview) e.preventDefault(); });
screens.quiz.addEventListener("paste", e => { if(!quizState.isReview) e.preventDefault(); });

function applyCheatingPenalty() {
    quizState.penaltiesApplied++;
    let penaltyCount = 0;
    
    // Find 5 unanswered questions to penalize
    for(let i=0; i < quizState.paper.length && penaltyCount < 5; i++) {
        if(!quizState.answers[i]) {
            // Mark as wrong
            quizState.answers[i] = { val: "CHEATING_PENALTY", isCorrect: false };
            
            // Remove from seenMap so it appears again
            const qId = quizState.paper[i].id || quizState.paper[i]._tempId;
            delete userData.seenMap[qId];
            
            penaltyCount++;
        }
    }
    
    saveProgress();
    updateNavStyles();
    
    alert(`ANTI-CHEAT WARNING: You left the test window! \n\nPenalty applied: ${penaltyCount} unanswered questions have been marked as INCORRECT and will be presented again in future tests. Please focus on the exam.`);
}

function generateQuiz() {
    if(!window.bankData || !window.bankData.length) return alert("Question Bank is empty or loading.");
    
    const count = parseInt(document.getElementById('qb-count').value);
    const modeTime = parseInt(document.getElementById('qb-mode').value); // 0 = Tutor, 60 = Mock
    
    let unseenPool = [], seenPool = [];
    
    window.bankData.forEach(q => {
        const id = q.id || q.question.substring(0, 50);
        q._tempId = id;
        if(userData.seenMap[id]) seenPool.push(q); else unseenPool.push(q);
    });
    
    // DIFFICULTY SORTING FOR MOCK TEST
    if(modeTime > 0) {
        // Sort unseen by length descending (longest vignettes are hardest)
        unseenPool.sort((a, b) => b.question.length - a.question.length);
        seenPool.sort((a, b) => b.question.length - a.question.length);
    } else {
        // Tutor mode is random
        unseenPool = shuffle(unseenPool); seenPool = shuffle(seenPool);
    }
    
    let paper = unseenPool.length >= count ? unseenPool.slice(0, count) : [...unseenPool, ...seenPool.slice(0, count - unseenPool.length)];
    paper = shuffle(paper); // Shuffle for presentation
    
    paper.forEach(q => userData.seenMap[q._tempId] = true);
    saveProgress();
    
    quizState = { paper, currentIndex: 0, answers: {}, flags: {}, timerInt: null, isReview: false, mode: modeTime, penaltiesApplied: 0 };
    
    if(modeTime > 0) {
        quizState.timeLeft = count * modeTime;
        document.getElementById('quiz-timer').classList.remove('hidden');
        startTimer();
        // Request Fullscreen for Immersive Mode
        try { document.documentElement.requestFullscreen(); } catch(e){}
    } else {
        document.getElementById('quiz-timer').classList.add('hidden');
    }
    
    // Enable Zen Mode UI (Hide non-essential elements via CSS classes if needed)
    document.body.classList.add('zen-mode');
    
    buildNavGrid();
    switchScreen('quiz');
    renderQ();
}

function shuffle(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
}

function startTimer() {
    clearInterval(quizState.timerInt); updateTimerDisplay();
    quizState.timerInt = setInterval(() => {
        quizState.timeLeft--; updateTimerDisplay();
        if(quizState.timeLeft <= 0) { clearInterval(quizState.timerInt); alert("Time's Up!"); endQuiz(); }
    }, 1000);
}
function updateTimerDisplay() {
    const m = Math.floor(quizState.timeLeft / 60).toString().padStart(2, '0');
    const s = (quizState.timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('time-display').innerText = `${m}:${s}`;
}

function buildNavGrid() {
    const grid = document.getElementById('nav-grid');
    grid.innerHTML = '';
    quizState.paper.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = 'n-box'; d.innerText = i+1;
        d.id = `nb-${i}`;
        d.addEventListener('click', () => { quizState.currentIndex = i; renderQ(); });
        grid.appendChild(d);
    });
}

function updateNavStyles() {
    for(let i=0; i<quizState.paper.length; i++) {
        const d = document.getElementById(`nb-${i}`);
        d.className = 'n-box';
        if(i === quizState.currentIndex) d.classList.add('active');
        if(quizState.flags[i]) d.classList.add('flagged');
        
        if(quizState.answers[i]) {
            if(quizState.isReview) d.classList.add(quizState.answers[i].isCorrect ? 'rev-cor' : 'rev-inc');
            else if(!d.classList.contains('active')) d.classList.add('done');
            
            // Highlight penalty in red even during test
            if(quizState.answers[i].val === "CHEATING_PENALTY") d.classList.add('rev-inc');
        }
    }
}

function renderQ() {
    const q = quizState.paper[quizState.currentIndex];
    const ans = quizState.answers[quizState.currentIndex];
    
    document.getElementById('q-curr').innerText = quizState.currentIndex + 1;
    document.getElementById('q-total').innerText = quizState.paper.length;
    // Source removed for FCPS Simulation per requirements.
    
    document.getElementById('q-text').innerText = q.question;
    
    const flagBtn = document.getElementById('btn-flag');
    if(quizState.flags[quizState.currentIndex]) flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i>';
    else flagBtn.innerHTML = '<i class="fa-regular fa-flag"></i>';
    
    flagBtn.onclick = () => { quizState.flags[quizState.currentIndex] = !quizState.flags[quizState.currentIndex]; updateNavStyles(); renderQ(); };

    const opts = document.getElementById('options-container');
    opts.innerHTML = '';
    const prefixes = ['A', 'B', 'C', 'D', 'E'];
    
    q.options.forEach((txt, i) => {
        if(!txt) return;
        const p = prefixes[i];
        const div = document.createElement('div');
        div.className = 'q-opt';
        div.innerHTML = `<span class="opt-lbl">${p}.</span><span class="opt-txt">${txt}</span>`;
        
        if(ans || quizState.isReview) div.classList.add('locked');
        
        if(!quizState.isReview && !ans) {
            div.addEventListener('click', () => {
                quizState.answers[quizState.currentIndex] = { val: p, isCorrect: p === q.correct_answer, fullText: txt };
                updateNavStyles(); renderQ();
            });
        }
        
        if(ans || quizState.isReview) {
            if(quizState.mode === 0 || quizState.isReview) {
                if(p === q.correct_answer) div.classList.add('correct');
                else if(ans && p === ans.val) div.classList.add('incorrect');
            } else {
                if(ans && p === ans.val) div.classList.add('selected');
            }
        }
        opts.appendChild(div);
    });

    const exp = document.getElementById('explanation-container');
    if(quizState.isReview || (ans && quizState.mode === 0)) {
        document.getElementById('exp-text').innerHTML = `<strong>Correct: ${q.correct_answer}</strong><br><br>${q.explanation}`;
        exp.classList.remove('hidden');
    } else { exp.classList.add('hidden'); }
    
    document.getElementById('btn-prev').disabled = quizState.currentIndex === 0;
    document.getElementById('btn-next').innerText = quizState.currentIndex === quizState.paper.length - 1 ? (quizState.isReview ? 'Finish' : 'Submit') : 'Next';
    
    updateNavStyles();
}

function goNext() {
    if(quizState.currentIndex < quizState.paper.length - 1) { quizState.currentIndex++; renderQ(); }
    else { quizState.isReview ? exitToPortal() : quitQuiz(); }
}
function goPrev() { if(quizState.currentIndex > 0) { quizState.currentIndex--; renderQ(); } }

function quitQuiz() {
    const un = quizState.paper.length - Object.keys(quizState.answers).length;
    if(un > 0 && !confirm(`You have ${un} unanswered questions. Submit anyway?`)) return;
    endQuiz();
}

function endQuiz() {
    clearInterval(quizState.timerInt);
    try { document.exitFullscreen(); } catch(e){}
    document.body.classList.remove('zen-mode');
    
    let cor = 0, inc = 0;
    
    // Process answers and Mistakes Bank
    for(let i=0; i<quizState.paper.length; i++) {
        const q = quizState.paper[i];
        const a = quizState.answers[i];
        
        if(a && a.isCorrect) {
            cor++;
        } else if(a && !a.isCorrect) {
            inc++;
            // Store mistake
            const correctOptFull = q.options[['A','B','C','D','E'].indexOf(q.correct_answer)];
            userData.mistakesBank.push({
                qId: q.id || q._tempId,
                questionText: q.question,
                category: q.category,
                wrongOption: a.val === "CHEATING_PENALTY" ? "CHEATING PENALTY (Unanswered)" : (a.fullText || a.val),
                correctOption: `${q.correct_answer}. ${correctOptFull}`,
                explanation: q.explanation
            });
        }
    }
    
    const omi = quizState.paper.length - (cor + inc);
    const pct = Math.round((cor / quizState.paper.length) * 100) || 0;
    
    userData.stats.attempted += quizState.paper.length;
    userData.stats.correct += cor;
    userData.stats.incorrect += inc;
    
    userData.history.push({
        date: Date.now(),
        mode: quizState.mode,
        total: quizState.paper.length,
        correct: cor,
        incorrect: inc,
        omitted: omi,
        timeSpent: quizState.mode > 0 ? ((quizState.paper.length * quizState.mode) - quizState.timeLeft) : 0
    });
    
    saveProgress();
    
    document.getElementById('res-cor').innerText = cor;
    document.getElementById('res-inc').innerText = inc;
    document.getElementById('res-omit').innerText = omi;
    document.getElementById('res-pct').innerText = pct + "%";
    
    switchScreen('res');
}

function startReview() { quizState.isReview = true; quizState.currentIndex = 0; switchScreen('quiz'); renderQ(); }
function exitToPortal() { initUser(); }
