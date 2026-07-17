// GLOBAL STATE (Using questions.js bankData)
let userData = {
    stats: { attempted: 0, correct: 0, incorrect: 0 },
    history: [],
    seenMap: {},
    mistakesBank: [] // Array of { qId, questionText, category, wrongOption, correctOption, explanation }
};

// DOM Elements
const screens = {
    login: document.getElementById('login-screen'),
    admin: document.getElementById('admin-screen'),
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
    initDB();
    // Check if user is logged in
    const authUser = localStorage.getItem('fcps_auth_user');
    if (authUser) {
        // Route to Admin or User
        const db = JSON.parse(localStorage.getItem('fcps_users_db'));
        if (db[authUser] && db[authUser].role === 'admin') {
            initAdmin();
        } else {
            loadUserData(authUser);
            initUser();
        }
    } else {
        switchScreen('login');
    }
});

function initDB() {
    let db = localStorage.getItem('fcps_users_db');
    if (!db) {
        db = {};
    } else {
        db = JSON.parse(db);
    }
    
    // Always ensure admin exists
    if (!db['admin@gmail.com']) {
        db['admin@gmail.com'] = { name: 'Super Admin', password: 'admin', role: 'admin', joinDate: new Date().toLocaleDateString(), premium: true };
        localStorage.setItem('fcps_users_db', JSON.stringify(db));
    }
}

function loadUserData(username) {
    const saved = localStorage.getItem('fcps_data_' + username);
    if (saved) {
        userData = JSON.parse(saved);
        if(!userData.mistakesBank) userData.mistakesBank = [];
    } else {
        userData = { stats: { attempted: 0, correct: 0, incorrect: 0 }, history: [], seenMap: {}, mistakesBank: [] };
        saveProgress();
    }
}

function saveProgress() {
    const authUser = localStorage.getItem('fcps_auth_user');
    if(authUser) {
        localStorage.setItem('fcps_data_' + authUser, JSON.stringify(userData));
    }
}

// ==========================================
// FULL MOCK AUTHENTICATION SYSTEM
// ==========================================

function toggleAuthView(viewId) {
    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('view-register').classList.add('hidden');
    document.getElementById('view-forgot').classList.add('hidden');
    
    document.getElementById(viewId).classList.remove('hidden');
    document.getElementById('auth-alert').classList.add('hidden');
    
    // Clear forms
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('forgot-form').reset();
}

function showAuthAlert(msg, type) {
    const alertDiv = document.getElementById('auth-alert');
    alertDiv.innerText = msg;
    alertDiv.className = `auth-alert ${type}`;
    alertDiv.classList.remove('hidden');
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const pass = document.getElementById('reg-password').value;
    const conf = document.getElementById('reg-confirm').value;

    if (pass !== conf) {
        return showAuthAlert("Passwords do not match.", "error");
    }

    const db = JSON.parse(localStorage.getItem('fcps_users_db'));
    if (db[email]) {
        return showAuthAlert("Account with this email already exists.", "error");
    }

    db[email] = { name, password: pass, role: 'student', joinDate: new Date().toLocaleDateString(), premium: false };
    localStorage.setItem('fcps_users_db', JSON.stringify(db));

    toggleAuthView('view-login');
    showAuthAlert("Account created successfully! Please log in.", "success");
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    
    const db = JSON.parse(localStorage.getItem('fcps_users_db'));
    
    if (!db[email]) {
        return showAuthAlert("Account not found. Please register.", "error");
    }
    
    if (db[email].password !== pass) {
        return showAuthAlert("Incorrect password.", "error");
    }
    
    // Login successful
    localStorage.setItem('fcps_auth_user', email);
    localStorage.setItem('fcps_auth_name', db[email].name);
    
    if (db[email].role === 'admin') {
        initAdmin();
    } else {
        loadUserData(email);
        initUser();
    }
}

function handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();
    const db = JSON.parse(localStorage.getItem('fcps_users_db'));
    
    if (!db[email]) {
        return showAuthAlert("No account found with this email.", "error");
    }
    
    // Mocking success
    toggleAuthView('view-login');
    showAuthAlert("A password reset link has been sent to your email.", "success");
}

function logout() {
    localStorage.removeItem('fcps_auth_user');
    localStorage.removeItem('fcps_auth_name');
    toggleAuthView('view-login');
    switchScreen('login');
}

// ==========================================
// ADMIN PORTAL
// ==========================================
function initAdmin() {
    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = '';
    
    const db = JSON.parse(localStorage.getItem('fcps_users_db')) || {};
    
    let totalUsers = 0;
    let premiumUsers = 0;
    let totalMcqs = 0;
    
    for (const email in db) {
        totalUsers++;
        const u = db[email];
        if (u.premium) premiumUsers++;
        
        // Count MCQs
        const uData = JSON.parse(localStorage.getItem('fcps_data_' + email));
        if (uData && uData.stats && uData.stats.attempted) {
            totalMcqs += uData.stats.attempted;
        }

        const isSelf = email === 'admin@gmail.com';
        
        let roleHtml = '';
        if (u.role === 'admin') roleHtml = '<span class="role-badge admin">Admin</span>';
        else if (u.premium) roleHtml = '<span class="role-badge premium">Premium <i class="fa-solid fa-crown" style="font-size:0.75rem;"></i></span>';
        else roleHtml = '<span class="role-badge">Free Tier</span>';
        
        const joinDateHtml = u.joinDate || 'Legacy User';
        
        const toggleBtn = isSelf ? '' : `<button class="btn btn-outline btn-icon" onclick="togglePremium('${email}')" title="Toggle Premium"><i class="fa-solid fa-crown ${u.premium ? 'text-warning' : ''}"></i></button>`;
        const deleteBtn = isSelf ? '' : `<button class="btn btn-outline-danger btn-icon" onclick="deleteUser('${email}')" title="Delete User"><i class="fa-solid fa-trash"></i></button>`;

        const actionHtml = isSelf ? 
            `<span class="text-muted" style="font-size:0.8rem;">Master</span>` : 
            `<div class="d-flex justify-content-center gap-3">${toggleBtn}${deleteBtn}</div>`;
            
        tbody.innerHTML += `
            <tr>
                <td><strong>${u.name}</strong></td>
                <td>${email}</td>
                <td>${joinDateHtml}</td>
                <td>${roleHtml}</td>
                <td class="text-center">${actionHtml}</td>
            </tr>
        `;
    }
    
    // Update Stats
    document.getElementById('admin-stat-users').innerText = totalUsers;
    document.getElementById('admin-stat-premium').innerText = premiumUsers;
    document.getElementById('admin-stat-mcqs').innerText = totalMcqs;
    
    switchScreen('admin');
}

function togglePremium(email) {
    const db = JSON.parse(localStorage.getItem('fcps_users_db'));
    if (db[email]) {
        db[email].premium = !db[email].premium;
        localStorage.setItem('fcps_users_db', JSON.stringify(db));
        initAdmin(); // Refresh
    }
}

function deleteUser(email) {
    if (confirm(`Are you sure you want to delete ${email}?\nThis action is irreversible and deletes their progress.`)) {
        const db = JSON.parse(localStorage.getItem('fcps_users_db'));
        delete db[email];
        localStorage.setItem('fcps_users_db', JSON.stringify(db));
        
        // Also clean up their progress data
        localStorage.removeItem('fcps_data_' + email);
        
        initAdmin(); // Refresh table
    }
}

// ==========================================
// USER PORTAL
// ==========================================
function initUser() {
    const authName = localStorage.getItem('fcps_auth_name') || 'Dr. Guest';
    document.getElementById('display-username').innerText = authName;

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

// Anti-Cheat Mechanisms (Tab switching penalty removed as requested)
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
    if(quizState.timeLeft <= 60 && quizState.timeLeft > 0) {
        document.getElementById('quiz-timer').classList.add('danger');
    } else {
        document.getElementById('quiz-timer').classList.remove('danger');
    }
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
        
        const shouldLock = quizState.isReview || (ans && quizState.mode > 0);
        if(shouldLock) div.classList.add('locked');
        
        if(!shouldLock) {
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
