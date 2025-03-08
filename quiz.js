const platformConfig = {
    'ark': {
        apiKey: '3654c0c8-acfd-469e-a1a4-eca3a9a95a5e',
        baseUrl: 'http://localhost:5000/proxy',
        model: 'bot-20250301110252-phnr8'
    }
};

let currentConfig = platformConfig['ark'];
let questionHistory = [];
let currentQuestionIndex = -1;

// DOM Elements
const schoolSelect = document.getElementById('school');
const gradeSelect = document.getElementById('grade');
const subjectSelect = document.getElementById('subject');
const questionBox = document.getElementById('question-box');
const optionsBox = document.getElementById('options-box');
const explanationBox = document.getElementById('explanation-box');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

// Add new DOM elements
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const quizSection = document.querySelector('.quiz-section');
const navigationButtons = document.querySelector('.navigation-panel-fixed'); // Changed from .navigation-panel

// Add new DOM element
const apiStatus = document.getElementById('api-status');
const statusDot = apiStatus.querySelector('.status-dot');
const statusText = apiStatus.querySelector('.status-text');

// Add new DOM element
const semesterSelect = document.getElementById('semester');

// Add new DOM element
const difficultySelect = document.getElementById('difficulty');

// Add status update function
function updateAPIStatus(status, message) {
    statusDot.className = 'status-dot';
    statusText.className = 'status-text';
    
    switch (status) {
        case 'connected':
            statusDot.classList.add('connected');
            statusText.classList.add('connected');
            break;
        case 'error':
            statusDot.classList.add('error');
            statusText.classList.add('error');
            break;
        default:
            // Default state - just black text
            break;
    }
    statusText.textContent = `API 状态: ${message}`;
}

// Check API connection on load
async function checkAPIConnection() {
    console.log('Checking API connection...'); // 调试日志
    try {
        updateAPIStatus('working', '正在连接...');
        console.log('Sending test request to:', currentConfig.baseUrl); // 调试日志
        
        const response = await fetch(platformConfig.ark.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${platformConfig.ark.apiKey}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello' }]
            })
        });

        console.log('API response status:', response.status); // 调试日志

        if (response.ok) {
            console.log('API connection successful'); // 调试日志
            updateAPIStatus('connected', '已连接');
            startBtn.disabled = false;  // 确保按钮被启用
            return true;
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('API connection error:', error);
        updateAPIStatus('error', '连接失败，请确保代理服务器正在运行');
        startBtn.disabled = true;  // 确保按钮被禁用
        return false;
    }
}

let questionsPerSet = 5;
let currentQuestionSet = [];

let score = {
    correct: 0,
    total: 0,
    answered: 0
};

// Add new DOM elements
const regenerateBtn = document.getElementById('regenerate-btn');
const scoreDisplay = document.querySelector('.score-display');
const scoreText = document.querySelector('.score-text');
const scoreDetails = document.querySelector('.score-details');

function resetScore() {
    score = {
        correct: 0,
        total: questionsPerSet,
        answered: 0
    };
    updateScoreDisplay();
}

function findWeakAreas() {
    const weakAreas = [];
    const questionCountBySubject = {};

    // 统计每个科目的题目数量和答对数量
    questionHistory.forEach((question, index) => {
        const selectedOption = questionBox.querySelector('.option-btn.selected');
        if (!selectedOption) {
            console.error('No selected option found for question:', question);
            return;
        }
        const userAnswer = selectedOption.dataset.letter;
        const correctAnswer = questionBox.dataset.correctAnswer;
        const subject = subjectSelect.options[subjectSelect.selectedIndex].text;

        if (!questionCountBySubject[subject]) {
            questionCountBySubject[subject] = { total: 0, correct: 0 };
        }
        questionCountBySubject[subject].total++;
        if (userAnswer === correctAnswer) {
            questionCountBySubject[subject].correct++;
        }
    });

    // 找出答对率低于50%的科目
    for (const [subject, counts] of Object.entries(questionCountBySubject)) {
        const correctRate = (counts.correct / counts.total) * 100;
        if (correctRate < 50) {
            weakAreas.push(subject);
        }
    }

    return weakAreas;
}

function updateScoreDisplay() {
    if (score.answered === score.total) {
        const percentage = Math.round((score.correct / score.total) * 100);
        scoreText.textContent = `最终得分: ${score.correct}/${score.total} (${percentage}%)`;
        scoreDetails.textContent = `共答对 ${score.correct} 题，答错 ${score.total - score.correct} 题`;
        scoreDisplay.style.display = 'block';
        regenerateBtn.style.display = 'block';

        // 添加评价逻辑
        let feedback = '';
        if (percentage >= 90) {
            feedback = '表现非常出色！继续保持！';
        } else if (percentage >= 70) {
            feedback = '表现良好！但还有提升空间。';
        } else if (percentage >= 50) {
            feedback = '表现一般，需要加强练习。';
        } else {
            feedback = '表现不佳，建议多复习相关知识点。';
        }

        // 查找薄弱环节
        const weakAreas = findWeakAreas();
        if (weakAreas.length > 0) {
            feedback += ` 薄弱环节：${weakAreas.join(', ')}。`;
        }

        // 显示反馈
        const feedbackText = document.createElement('div');
        feedbackText.className = 'feedback-text';
        feedbackText.textContent = feedback;
        scoreDisplay.appendChild(feedbackText);

        // Add analysis after showing score
        analyzeQuizResults();
    }
}

// Add new DOM element
const questionCountSelect = document.getElementById('questionCount');

// Add question validation function
function validateQuestion(question, index) {
    // Check question format
    if (!question.match(/题目：.+/)) {
        throw new Error(`第 ${index + 1} 题缺少题目`);
    }

    // Check options format
    const hasAllOptions = ['A.', 'B.', 'C.', 'D.'].every(opt => 
        question.includes(opt)
    );
    if (!hasAllOptions) {
        throw new Error(`第 ${index + 1} 题选项不完整`);
    }

    // Check answer format
    const answerMatch = question.match(/答案：([A-D])/);
    if (!answerMatch) {
        throw new Error(`第 ${index + 1} 题缺少答案`);
    }

    // Check explanation format - enhanced validation
    const explanationMatch = question.match(/解析：(.+)/);
    if (!explanationMatch || !explanationMatch[1].trim()) {
        throw new Error(`第 ${index + 1} 题缺少解析或解析内容为空`);
    }

    // Verify explanation length
    const explanation = explanationMatch[1].trim();
    if (explanation.length < 10) {
        throw new Error(`第 ${index + 1} 题解析内容过短，请提供详细解析`);
    }

    return true;
}

// Add robust question parsing
function parseQuestion(rawQuestion, index) {
    try {
        // Clean the question text
        const cleanQuestion = rawQuestion.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        // Validate the cleaned question
        validateQuestion(cleanQuestion, index);

        // Extract question content
        const questionMatch = cleanQuestion.match(/题目：([\s\S]+?)(?=A\.)/);
        const question = questionMatch ? questionMatch[1].trim() : '';

        // Extract options
        const options = [];
        const optionMatches = cleanQuestion.matchAll(/([A-D]\.[\s\S]+?)(?=[A-D]\.|\n答案：|$)/g);
        for (const match of optionMatches) {
            options.push(match[1].trim());
        }

        // Extract answer
        const answerMatch = cleanQuestion.match(/答案：([A-D])/);
        const answer = answerMatch ? answerMatch[1] : '';

        // Extract explanation with improved pattern
        const explanationMatch = cleanQuestion.match(/解析：([\s\S]+)$/s);
        const explanation = explanationMatch ? explanationMatch[1].trim() : '';

        // Final validation of all components
        if (!question || options.length !== 4 || !answer || !explanation) {
            throw new Error(`第 ${index + 1} 题格式不完整`);
        }

        return {
            question,
            options,
            answer,
            explanation
        };
    } catch (error) {
        console.error(`Question ${index + 1} parsing error:`, error);
        throw new Error(`第 ${index + 1} 题解析失败: ${error.message}`);
    }
}

async function generateQuestionSet() {
    try {
        // Verify all required DOM elements exist
        const requiredElements = {
            questionBox: document.getElementById('question-box'),
            optionsBox: document.getElementById('options-box'),
            explanationBox: document.getElementById('explanation-box'),
            quizSection: document.querySelector('.quiz-section'),
            navigationButtons: document.querySelector('.navigation-panel-fixed'), // Changed from .navigation-buttons
            scoreDisplay: document.querySelector('.score-display'),
            startBtn: document.getElementById('start-btn'),
            submitBtn: document.getElementById('submit-btn')
        };

        // Check if any required element is missing
        for (const [name, element] of Object.entries(requiredElements)) {
            if (!element) {
                throw new Error(`Required element "${name}" not found in the document`);
            }
        }

        console.log('Starting question generation...'); // 调试日志
        questionsPerSet = parseInt(questionCountSelect.value);
        
        resetScore();
        requiredElements.scoreDisplay.style.display = 'none';
        requiredElements.quizSection.style.display = 'block';
        requiredElements.navigationButtons.style.display = 'flex';
        requiredElements.startBtn.style.display = 'none';
        regenerateBtn.style.display = 'block'; // Always show regenerate button

        const schoolType = schoolSelect.value === 'primary' ? '小学' : 
                          schoolSelect.value === 'middle' ? '初中' : '高中';
        const grade = gradeSelect.value;
        const semester = semesterSelect.value === 'first' ? '上学期' : '下学期';
        const subject = subjectSelect.options[subjectSelect.selectedIndex].text;

        // Add difficulty level descriptions based on school type and grade
        const difficultyContext = getDifficultyContext(schoolType, grade, semester, difficultySelect.value);

        const prompt = getPrompt(schoolType, grade, semester, subject, questionsPerSet);

        updateAPIStatus('working', `正在生成${questionsPerSet}道题目...`);
        showLoading(questionBox, `正在生成${questionsPerSet}道题目，请稍候...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

        const response = await fetch(platformConfig.ark.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${platformConfig.ark.apiKey}`
            },
            body: JSON.stringify({
                model: currentConfig.model,
                messages: [
                    {
                        role: "system",
                        content: "你是一位教师，专门用于出题和解答"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('Response status:', response.status); // 调试日志

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API请求失败: ${response.status} - ${errorText}`);
            throw new Error(`API请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('API response status:', response.status); // Keep only status logging

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('API返回数据格式无效');
        }

        const allContent = data.choices[0].message.content;

        // 处理返回的内容
        const rawQuestions = allContent.split('===').map(q => q.trim()).filter(q => q.length > 0);

        if (rawQuestions.length < questionsPerSet) {
            throw new Error(`生成的题目数量不足，仅生成了 ${rawQuestions.length} 道题目`);
        }

        currentQuestionSet = rawQuestions.map((rawQuestion, index) => {
            try {
                return parseQuestion(rawQuestion, index);
            } catch (error) {
                console.error(`Question ${index + 1} parsing error:`, error);
                throw error;
            }
        });

        // 验证所有题目的完整性
        const invalidQuestions = currentQuestionSet.filter(q => 
            !q.question || !q.options || q.options.length !== 4 || !q.answer || !q.explanation
        );

        if (invalidQuestions.length > 0) {
            throw new Error(`有 ${invalidQuestions.length} 道题目格式不完整，请重新生成`);
        }

        questionHistory = currentQuestionSet;
        currentQuestionIndex = 0;
        
        displayQuestion(currentQuestionSet[0]);
        updateAPIStatus('connected', `已生成 ${currentQuestionSet.length} 道题目`);
        updateNavigationButtons();

    } catch (error) {
        console.error('Question generation error:', error);
        let errorMessage;
        
        if (error.name === 'AbortError') {
            errorMessage = '生成题目超时，请重试';
        } else if (error.message.includes('504')) {
            errorMessage = '服务器响应超时，请稍后重试';
        } else {
            errorMessage = `生成题目失败: ${error.message}`;
        }
        
        updateAPIStatus('error', errorMessage);
        
        if (questionBox) {
            questionBox.innerHTML = `
                <div class="error-message">
                    <p>${errorMessage}</p>
                    <button onclick="retryGeneration()" class="retry-btn">重新生成</button>
                    <button onclick="window.location.reload()" class="reset-btn">重置页面</button>
                </div>`;
        }
        
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.style.display = 'block';
            startBtn.textContent = '开始出题';
        }
    }
}

// Add retry function
function retryGeneration() {
    const retryCount = parseInt(questionBox.dataset.retryCount || '0');
    if (retryCount < 3) {
        questionBox.dataset.retryCount = retryCount + 1;
        generateQuestionSet();
    } else {
        alert('多次重试失败，请检查网络连接或稍后再试');
        window.location.reload();
    }
}

// Add new helper function to generate difficulty context
function getDifficultyContext(schoolType, grade, semester, difficulty) {
    const gradeNum = parseInt(grade);
    let context = '';
    const difficultyAdjustment = {
        easy: '降低难度，确保基础性和易理解性',
        medium: '保持中等难度，考察综合应用能力',
        hard: '适当提高难度，加入思维拓展内容'
    }[difficulty];

    switch(schoolType) {
        case '小学':
            if (gradeNum <= 2) {
                context = `
- 使用简单直观的语言
- 题目以基础概念为主
- 计算题限制在20以内的运算
- 文字题应该简短且场景熟悉
- 避免使用复杂的抽象概念`;
            } else if (gradeNum <= 4) {
                context = `
- 可以包含较复杂的计算
- 可以涉及简单的应用题
- 允许使用基础的数学概念
- 题目长度适中
- 解题步骤不超过2步`;
            } else {
                context = `
- 可以包含多步骤计算
- 包含一定的逻辑推理
- 可以使用更多数学概念
- 适当增加题目难度
- 解题步骤可以达到3步`;
            }
            break;

        case '初中':
            if (gradeNum === 1) {
                context = `
- 从小学到初中的过渡难度
- 引入初中基础概念
- 计算难度适中
- 题目可以包含一定抽象思维
- 解题步骤3-4步为宜`;
            } else {
                context = `
- 完整使用初中数学概念
- 可以包含较复杂的推理
- 综合运用多个知识点
- 题目难度符合年级水平
- 解题步骤可以较多`;
            }
            break;

        case '高中':
            if (gradeNum === 1) {
                context = `
- 注重基础知识的掌握
- 适当引入高中新概念
- 题目难度循序渐进
- 可以包含一定的综合性题目
- 解题思路要清晰`;
            } else {
                context = `
- 可以考察较深的知识点
- 包含综合性应用题
- 要求较强的解题能力
- 可以有一定的创新性思维
- 难度符合高考要求`;
            }
            break;
    }

    // Add difficulty-specific adjustments
    context += `\n- ${difficultyAdjustment}`;
    
    // Add semester-specific adjustments
    if (semester === '上学期') {
        context += `\n- 作为${schoolType}${grade}年级上学期题目，重点考察本学期前半段的知识点`;
    } else {
        context += `\n- 作为${schoolType}${grade}年级下学期题目，可以综合运用全学年的知识点`;
    }

    return context;
}

function getPrompt(schoolType, grade, semester, subject, questionsPerSet) {
    const difficulty = difficultySelect.value;
    const difficultyText = difficulty === 'easy' ? '低' : difficulty === 'medium' ? '中' : '高';
    
    return `作为一位经验丰富的${schoolType}${subject}老师，请严格按照以下格式生成${questionsPerSet}道${grade}年级${semester}的选择题，难度要求为${difficultyText}级。

严格的格式要求：
每道题必须包含以下六个部分，缺一不可：
1. "题目："后接具体题目
2. "A."后接选项A的内容
3. "B."后接选项B的内容
4. "C."后接选项C的内容
5. "D."后接选项D的内容
6. "答案："后接正确选项（必须是A、B、C、D其中之一）
7. "解析："后必须包含完整的解析（至少100字）

解析部分必须包含以下内容（缺一不可）：
1. 解题思路和方法
2. 关键知识点解释
3. 正确答案的推导过程
4. 为什么其他选项是错误的
5. 相关知识点的总结
6. 易错点提醒

示例格式：
题目：[题目内容]
A. [选项A内容]
B. [选项B内容]
C. [选项C内容]
D. [选项D内容]
答案：[A或B或C或D]
解析：本题主要考察[知识点]。解题思路是[详细说明]。首先，[推导过程]。选项分析：A选项[分析]，B选项[分析]，C选项[分析]，D选项[分析]。需要注意的是[易错点]。总的来说，[知识点总结]。同学们在解题时要特别注意[关键提醒]。

题目质量要求：
1. 题目表述必须清晰、准确，无歧义
2. 选项内容必须完整，符合逻辑
3. 所有选项必须有实际意义，不能有无意义的干扰项
4. 难度必须符合年级水平
5. 解析必须详尽，有教育意义

难度设置：
${getDifficultyContext(schoolType, grade, semester, difficulty)}

请生成${questionsPerSet}道题目，每道题之间用===分隔。注意每道题都必须完全符合上述格式要求，特别是解析部分必须详尽完整。`;
}

function updateNavigationButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questionsPerSet - 1;
    
    // Update question number only
    const questionNumber = document.querySelector('.question-number');
    if (questionNumber) {
        questionNumber.textContent = `题目 ${currentQuestionIndex + 1}/${questionsPerSet}`;
    }
}

function displayQuestion(questionData) {
    if (!questionData || !questionData.question || !questionData.options) {
        console.error('Invalid question data:', questionData);
        throw new Error('题目数据无效');
    }

    try {
        // Display question only (no options)
        questionBox.innerHTML = questionData.question;
        
        // Store answer and explanation
        questionBox.dataset.correctAnswer = questionData.answer;
        questionBox.dataset.explanation = questionData.explanation;

        // Add a data attribute to store user answer
        questionBox.dataset.userAnswer = '';

        // Display options
        optionsBox.innerHTML = '';
        questionData.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option;
            button.dataset.letter = option[0];
            button.onclick = () => selectOption(button);
            optionsBox.appendChild(button);
        });

        explanationBox.innerHTML = '';

    } catch (error) {
        console.error('Display error:', error);
        console.error('Question data causing error:', questionData);
        questionBox.innerHTML = `显示题目时出错: ${error.message}`;
        optionsBox.innerHTML = '<button onclick="generateQuestionSet()">重试</button>';
    }
}

function selectOption(button) {
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    button.classList.add('selected');
    submitBtn.style.display = 'block'; // Show submit button after selection

    // Store the selected answer
    questionBox.dataset.userAnswer = button.dataset.letter;
}

function showExplanation(questionData) {
    const selectedOption = document.querySelector('.option-btn.selected');
    if (!selectedOption) {
        explanationBox.innerHTML = '<div class="incorrect">请先选择一个答案！</div>';
        return;
    }

    try {
        const correctAnswer = questionBox.dataset.correctAnswer;
        const explanation = questionBox.dataset.explanation;

        if (!correctAnswer || !explanation) {
            throw new Error('无法找到答案或解析');
        }
        
        const selectedLetter = selectedOption.dataset.letter;
        const isCorrect = selectedLetter === correctAnswer;
        
        // Update score
        score.answered++;
        if (isCorrect) score.correct++;
        
        explanationBox.innerHTML = `
            <div class="${isCorrect ? 'correct' : 'incorrect'}">
                ${isCorrect ? '✅ 回答正确！' : '❌ 回答错误！'}
            </div>
            <div class="correct-answer">正确答案: ${correctAnswer}</div>
            <div class="explanation">${explanation}</div>
        `;

        // Store the answer in question history
        const currentQuestion = questionHistory[currentQuestionIndex];
        currentQuestion.userAnswer = selectedLetter;

        // Disable options and show score if all questions answered
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.dataset.letter === correctAnswer) {
                btn.classList.add('correct-option');
            }
        });

        if (score.answered === score.total) {
            showQuizResults();
        }

    } catch (error) {
        console.error('Explanation error:', error);
        explanationBox.innerHTML = `<div class="incorrect">解析显示出错: ${error.message}</div>`;
    }
}

// Add validation function
function validateSelections() {
    const school = schoolSelect.value;
    const grade = gradeSelect.value;
    const subject = subjectSelect.value;

    // Check if subject is appropriate for school level
    if (school === 'primary' && ['biology', 'physics'].includes(subject)) {
        alert('小学阶段暂不提供生物和物理课程');
        return false;
    }

    // Validate grade selection for middle/high school
    if (school !== 'primary' && grade > 3) {
        alert('初中和高中只有1-3年级');
        gradeSelect.value = '1';
        return false;
    }

    // Check geography/history/biology/physics for appropriate grades
    if (['geography', 'history', 'biology', 'physics'].includes(subject)) {
        if (school === 'primary' || (school === 'middle' && grade === '1')) {
            alert(`${subjectSelect.options[subjectSelect.selectedIndex].text}课程从初中二年级开始`);
            return false;
        }
    }

    return true;
}

// Update next question function
async function nextQuestion() {
    if (!validateSelections()) {
        return;
    }

    submitBtn.style.display = 'none';
    explanationBox.innerHTML = '';
    await generateQuestionSet();
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    console.log('Start button clicked'); // 调试日志

    if (!validateSelections()) {
        console.log('Validation failed'); // 调试日志
        return;
    }

    try {
        startBtn.disabled = true;
        startBtn.textContent = '正在生成...';
        showLoading(questionBox, '正在生成题目，请稍候...');
        
        // 确保API连接正常
        //const isConnected = await checkAPIConnection();
        //if (!isConnected) {
        //    throw new Error('API未连接');
        //}

        await generateQuestionSet();
        
    } catch (error) {
        console.error('Generation error:', error);
        alert('生成题目失败：' + error.message);
        questionBox.innerHTML = `生成题目失败: ${error.message}`;
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = '开始出题';
    }
});

nextBtn.addEventListener('click', () => {
    if (currentQuestionIndex < questionHistory.length - 1) {
        currentQuestionIndex++;
        displayQuestion(questionHistory[currentQuestionIndex]);
        submitBtn.style.display = 'none';
        explanationBox.innerHTML = '';
        updateNavigationButtons();
    }
});

prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(questionHistory[currentQuestionIndex]);
        submitBtn.style.display = 'none';
        explanationBox.innerHTML = '';
        updateNavigationButtons();
    }
});

submitBtn.addEventListener('click', () => {
    showExplanation(questionHistory[currentQuestionIndex]);
    submitBtn.style.display = 'none';
});

// Add regenerate button handler with checks
regenerateBtn.addEventListener('click', async () => {
    if (confirm('确定要重新生成题目吗？当前进度将丢失。')) {
        try {
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = '生成中...';
            await generateQuestionSet();
        } finally {
            regenerateBtn.disabled = false;
            regenerateBtn.textContent = '重新生成题目';
        }
    }
});

// Update initial state
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get all required DOM elements
        const elements = {
            startBtn: document.getElementById('start-btn'),
            quizSection: document.querySelector('.quiz-section'),
            quizContainer: document.querySelector('.quiz-section-container'),
            chatInterface: document.querySelector('.chat-interface'),
            navigationButtons: document.querySelector('.navigation-panel-fixed'),
            scoreDisplay: document.querySelector('.score-display'),
            apiStatus: document.getElementById('api-status'),
            statusDot: document.querySelector('.status-dot'),
            statusText: document.querySelector('.status-text')
        };

        // Verify all elements exist
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                throw new Error(`Required element "${name}" not found during initialization`);
            }
        });

        // Initialize UI state
        elements.quizSection.style.display = 'none';
        elements.quizContainer.style.display = 'none';
        elements.chatInterface.style.display = 'block';
        elements.navigationButtons.style.display = 'none';
        elements.scoreDisplay.style.display = 'none';
        elements.startBtn.disabled = true;
        elements.startBtn.textContent = '正在连接...';

        // Check API connection
        const isConnected = await checkAPIConnection();
        if (isConnected) {
            elements.startBtn.disabled = false;
            elements.startBtn.textContent = '开始出题';
        } else {
            elements.startBtn.textContent = 'API未连接';
        }

        // Add button tooltips
        const buttonTooltips = {
            'start-btn': '点击开始生成题目',
            'submit-btn': '提交你的答案',
            'prev-btn': '返回上一题',
            'next-btn': '进入下一题'
        };

        Object.entries(buttonTooltips).forEach(([id, text]) => {
            const button = document.getElementById(id);
            if (button) {
                button.title = text;
            }
        });

        // 在文件开头添加这段代码，处理麦克风权限
        document.addEventListener('DOMContentLoaded', function() {
            // 预先请求麦克风权限，避免重复请求
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                // 在用户首次与页面交互时请求权限
                document.body.addEventListener('click', function requestMicrophonePermission() {
                    navigator.mediaDevices.getUserMedia({ audio: true })
                        .then(function(stream) {
                            // 获取权限后立即关闭流
                            stream.getTracks().forEach(track => track.stop());
                            console.log('麦克风权限已获取');
                            // 移除事件监听器，避免重复请求
                            document.body.removeEventListener('click', requestMicrophonePermission);
                        })
                        .catch(function(err) {
                            console.error('麦克风权限获取失败:', err);
                        });
                }, { once: true }); // 只执行一次
            }
            
            // 其余初始化代码...
        });

        // 在DOMContentLoaded事件中添加以下代码
        document.addEventListener('DOMContentLoaded', function() {
            // 重构聊天控件布局
            const chatControls = document.querySelector('.chat-controls');
            if (chatControls) {
                // 保存现有元素
                const chatInput = chatControls.querySelector('.chat-input');
                const chatSubmit = chatControls.querySelector('.chat-submit');
                
                // 清空现有内容
                chatControls.innerHTML = '';
                
                // 创建左侧和右侧控件组
                const leftControls = document.createElement('div');
                leftControls.className = 'chat-controls-left';
                
                const rightControls = document.createElement('div');
                rightControls.className = 'chat-controls-right';
                
                // 将输入框添加到左侧
                if (chatInput) leftControls.appendChild(chatInput);
                
                // 将提交按钮添加到右侧
                if (chatSubmit) rightControls.appendChild(chatSubmit);
                
                // 将控件组添加到容器
                chatControls.appendChild(leftControls);
                chatControls.appendChild(rightControls);
            }
        });

    } catch (error) {
        console.error('Initialization error:', error);
        alert(`页面初始化失败: ${error.message}\n请刷新页面重试。`);
    }
});

// Enhance error handling
function handleError(error, retryFunction) {
    const errorMessage = `
        <div class="error-message">
            <p>${error.message}</p>
            <button onclick="${retryFunction.name}()">重试</button>
            <button onclick="window.location.reload()">重置</button>
        </div>
    `;
    return errorMessage;
}

// Add loading indicators
function showLoading(element, message = '加载中...') {
    element.innerHTML = `
        <div class="loading-spinner"></div>
        <span>${message}</span>
    `;
}

// Add confirmation for leaving page with unsaved progress
window.addEventListener('beforeunload', (e) => {
    if (score.answered > 0 && score.answered < score.total) {
        e.preventDefault();
        e.returnValue = '你还有未完成的题目，确定要离开吗？';
    }
});

// Add new function to analyze quiz results
async function analyzeQuizResults() {
    const analyzeBtn = document.getElementById('analyze-btn');
    analyzeBtn.style.display = 'none';
    
    const analyzeStatus = document.createElement('div');
    analyzeStatus.className = 'analyzing-status';
    analyzeStatus.innerHTML = `
        <div class="loading-spinner"></div>
        <span>分析中，请稍候...</span>
    `;
    scoreDisplay.appendChild(analyzeStatus);

    try {
        const results = questionHistory.map((question, index) => ({
            question: question.question,
            userAnswer: question.userAnswer || '未作答',
            correctAnswer: question.answer,
            isCorrect: question.userAnswer === question.answer,
            explanation: question.explanation
        }));

        const analysisPrompt = `亲爱的智慧教师，请帮我分析这位同学的答题表现：

基本信息：
📚 学段：${schoolSelect.value === 'primary' ? '小学' : schoolSelect.value === 'middle' ? '初中' : '高中'}
📝 年级：${gradeSelect.value}年级
📖 科目：${subjectSelect.options[subjectSelect.selectedIndex].text}
⭐ 难度：${difficultySelect.options[difficultySelect.selectedIndex].text}
✨ 得分：${score.correct}/${score.total} (${Math.round((score.correct / score.total) * 100)}%)

详细答题记录：
${results.map((r, i) => `
第${i + 1}题：${r.isCorrect ? '✓' : '❌'}
题目：${r.question}
学生答案：${r.userAnswer}
正确答案：${r.correctAnswer}
解析：${r.explanation}
`).join('\n')}

请按照以下五个方面进行分析，每个部分至少提供3-4点具体内容：

总体表现评价
• 整体答题表现分析
• 知识掌握程度评估
• 解题思路和方法评价

知识点掌握情况
• 已掌握的知识点（请具体指出）
• 需要加强的知识点（请具体指出）
• 知识运用能力分析

易错点分析
• 错误原因分析（针对具体题目）
• 典型错误模式总结
• 易混淆知识点辨析

针对性改进建议
• 具体的学习方法建议
• 练习重点推荐
• 时间分配建议

推荐复习重点
• 需要重点关注的知识点
• 推荐的练习题型
• 建议的学习资源

回复要求：
1. 保持鼓励性的语气
2. 每个分析点要具体明确
3. 建议要可操作可执行
4. 适当使用表情符号增加亲和力

请确保分析内容具体且有针对性，避免模糊的表述。`;

        updateAPIStatus('working', '正在分析答题情况...');

        const response = await fetch(platformConfig.ark.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${platformConfig.ark.apiKey}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: analysisPrompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`API响应错误 (${response.status})`);
        }

        const data = await response.json();
        const analysis = data.choices[0].message.content;

        // Remove existing analysis and status
        const existingElements = scoreDisplay.querySelectorAll('.analysis-results, .analyzing-status');
        existingElements.forEach(el => el.remove());

        // Display new analysis
        const analysisElement = document.createElement('div');
        analysisElement.className = 'analysis-results';
        analysisElement.innerHTML = `
            <h3>学习分析报告</h3>
            ${displayAnalysisResults(analysis)}
        `;

        scoreDisplay.appendChild(analysisElement);
        updateAPIStatus('connected', '分析完成');

        // 在分析结果显示后添加语音朗读按钮
        const analysisResults = document.querySelector('.analysis-results');
        if (analysisResults) {
            const speakerButton = document.createElement('button');
            speakerButton.className = 'speaker-btn';
            speakerButton.innerHTML = '<i class="fas fa-volume-up"></i> 朗读分析';
            speakerButton.title = "语音朗读分析结果";
            
            // 将按钮添加到分析结果上方
            analysisResults.insertBefore(speakerButton, analysisResults.firstChild);
            
            // 添加点击事件
            speakerButton.addEventListener('click', function() {
                // 获取分析文本
                const analysisText = getAnalysisTextForSpeech(analysisResults);
                
                // 使用语音合成API朗读文本
                speakText(analysisText);
            });
        }

    } catch (error) {
        console.error('Analysis error:', error);
        const analyzeStatus = scoreDisplay.querySelector('.analyzing-status');
        if (analyzeStatus) {
            analyzeStatus.remove();
        }

        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <p>分析失败: ${error.message}</p>
            <button onclick="retryAnalysis()" class="retry-btn">重试分析</button>
        `;
        scoreDisplay.appendChild(errorElement);
        updateAPIStatus('error', '分析失败');
    }
}

// Add retry function
function retryAnalysis() {
    const errorMessage = scoreDisplay.querySelector('.error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
    showQuizResults();
}

// Add new function to display analysis results
function displayAnalysisResults(analysis) {
    // Clean up the text
    const cleanedAnalysis = analysis
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[一二三四五]、/g, '')
        .replace(/^\d+\.\s*/gm, '')
        .trim();

    return `
        <div class="analysis-section">
            <h4>答题成绩总结</h4>
            <div class="analysis-content">
                ${parseAnalysisContent(cleanedAnalysis)}
            </div>
        </div>
    `;
}

function parseAnalysisContent(text) {
    // Split text into paragraphs and filter out empty lines
    const paragraphs = text.split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // Convert paragraphs to HTML points
    return paragraphs.map(paragraph => {
        // Clean up the paragraph
        const cleanedPoint = paragraph
            .replace(/^[【\[［].+?[】\]］][:：]?\s*/, '')
            .replace(/^[•\-]\s*/, '')
            .split(/[。！？]/)
            .filter(sentence => sentence.trim().length > 0)
            .join('。');

        return `<div class="analysis-point">${cleanedPoint}</div>`;
    }).join('');
}

// Remove the automatic question generation
// Initialize first question
// generateQuestion();  // Remove this line

// Replace the updateScoreDisplay function with showQuizResults
async function showQuizResults() {
    if (score.answered === score.total) {
        const percentage = Math.round((score.correct / score.total) * 100);
        
        // Clean up any existing results first
        while (scoreDisplay.firstChild) {
            scoreDisplay.firstChild.remove();
        }
        
        // Show basic score
        const scoreTextElement = document.createElement('div');
        scoreTextElement.className = 'score-text';
        scoreTextElement.textContent = `最终得分: ${score.correct}/${score.total} (${percentage}%)`;
        scoreDisplay.appendChild(scoreTextElement);
        
        // Show feedback button
        const analyzeBtn = document.createElement('button');
        analyzeBtn.id = 'analyze-btn';
        analyzeBtn.className = 'analyze-btn';
        analyzeBtn.textContent = '评估表现';
        analyzeBtn.onclick = analyzeQuizResults;
        scoreDisplay.appendChild(analyzeBtn);
        
        scoreDisplay.style.display = 'block';
    }
}

// Helper functions for showQuizResults
function getBadgeForScore(percentage) {
    if (percentage >= 90) return {
        class: 'excellent',
        icon: '🏆',
        text: '优秀'
    };
    if (percentage >= 80) return {
        class: 'great',
        icon: '🌟',
        text: '良好'
    };
    if (percentage >= 60) return {
        class: 'pass',
        icon: '✅',
        text: '及格'
    };
    return {
        class: 'needs-work',
        icon: '📚',
        text: '需要努力'
    };
}

function calculateQuizTime() {
    // Add quiz start time tracking if not already present
    const endTime = new Date();
    const startTime = window.quizStartTime || endTime;
    const timeDiff = endTime - startTime;
    const minutes = Math.floor(timeDiff / 60000);
    const seconds = Math.floor((timeDiff % 60000) / 1000);
    return `${minutes}分${seconds}秒`;
}

function generateKnowledgeMap(results) {
    // Generate visual representation of knowledge mastery
    const knowledgeAreas = analyzeKnowledgeAreas(results);
    return knowledgeAreas.map(area => `
        <div class="knowledge-item">
            <span class="knowledge-name">${area.name}</span>
            <div class="mastery-bar">
                <div class="mastery-fill" style="width: ${area.mastery}%"></div>
            </div>
            <span class="mastery-percentage">${area.mastery}%</span>
        </div>
    `).join('');
}

// Add analyzeKnowledgeAreas function
function analyzeKnowledgeAreas(results) {
    const knowledgeAreas = [];
    const totalQuestions = results.length;
    
    // Group questions by type/topic
    const topics = groupQuestionsByTopic(results);
    
    // Calculate mastery for each topic
    Object.entries(topics).forEach(([topic, questions]) => {
        const correctCount = questions.filter(q => q.isCorrect).length;
        const mastery = Math.round((correctCount / questions.length) * 100);
        
        knowledgeAreas.push({
            name: topic,
            mastery: mastery,
            totalQuestions: questions.length,
            correctCount: correctCount
        });
    });
    
    return knowledgeAreas;
}

// Add helper function to group questions by topic
function groupQuestionsByTopic(results) {
    const topics = {};
    const subject = subjectSelect.options[subjectSelect.selectedIndex].text;
    
    results.forEach((result, index) => {
        // Analyze question content to determine topic
        const topic = getQuestionTopic(result.question, subject, index + 1);
        
        if (!topics[topic]) {
            topics[topic] = [];
        }
        topics[topic].push(result);
    });
    
    return topics;
}

// Add helper function to determine question topic
function getQuestionTopic(question, subject, questionNumber) {
    // Simple topic detection based on keywords
    const mathTopics = {
        '计算': ['计算', '求值', '等于', '+', '-', '×', '÷'],
        '几何': ['三角形', '正方形', '圆', '面积', '周长', '体积'],
        '代数': ['方程', '函数', '表达式', '化简'],
        '应用题': ['问题', '小明', '商店', '篮子', '售价'],
        '概率统计': ['概率', '可能性', '统计', '频率']
    };
    
    for (const [topic, keywords] of Object.entries(mathTopics)) {
        if (keywords.some(keyword => question.includes(keyword))) {
            return topic;
        }
    }
    
    // Default topic if no match found
    return `${subject}知识点 ${questionNumber}`;
}

// Add retry analysis function
function retryAnalysis() {
    // Remove previous analysis results
    const existingAnalysis = document.querySelectorAll('.analysis-results, .quiz-results');
    existingAnalysis.forEach(element => element.remove());
    
    // Remove previous loading feedback
    const existingLoading = document.querySelector('.feedback-loading');
    if (existingLoading) {
        existingLoading.remove();
    }
    
    // Clear any error messages
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(element => element.remove());
    
    // Retry the analysis
    showQuizResults();
}

// Add quiz start time tracking
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...
    
    // Add quiz start time tracking
    startBtn.addEventListener('click', () => {
        window.quizStartTime = new Date();
    });
});

// Add event listener for the analyze button
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...
    const analyzeBtn = document.getElementById('analyze-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', analyzeQuizResults);
    }
});

// Add event listener for school select to update grade options
schoolSelect.addEventListener('change', () => {
    const schoolType = schoolSelect.value;
    const gradeOptions = gradeSelect.options;
    
    // Clear existing options
    while (gradeOptions.length > 0) {
        gradeOptions.remove(0);
    }
    
    // Add appropriate options based on school type
    if (schoolType === 'primary') {
        for (let i = 1; i <= 6; i++) {
            const option = new Option(`${i}年级`, i.toString());
            gradeOptions.add(option);
        }
    } else {
        // For middle and high school, only show grades 1-3
        for (let i = 1; i <= 3; i++) {
            const option = new Option(`${i}年级`, i.toString());
            gradeOptions.add(option);
        }
    }
    
    // Select first option
    gradeSelect.selectedIndex = 0;
});

// Define subject configurations for different school types
const schoolSubjects = {
    primary: [
        { value: 'math', text: '数学' },
        { value: 'chinese', text: '语文' },
        { value: 'english', text: '英语' },
        { value: 'science', text: '科学' }
    ],
    middle: [
        { value: 'math', text: '数学' },
        { value: 'chinese', text: '语文' },
        { value: 'english', text: '英语' },
        { value: 'physics', text: '物理' },
        { value: 'chemistry', text: '化学' },
        { value: 'biology', text: '生物' },
        { value: 'geography', text: '地理' },
        { value: 'history', text: '历史' }
    ],
    high: [
        { value: 'math', text: '数学' },
        { value: 'chinese', text: '语文' },
        { value: 'english', text: '英语' },
        { value: 'physics', text: '物理' },
        { value: 'chemistry', text: '化学' },
        { value: 'biology', text: '生物' },
        { value: 'geography', text: '地理' },
        { value: 'history', text: '历史' }
    ]
};

// Update school select event listener
schoolSelect.addEventListener('change', () => {
    const schoolType = schoolSelect.value;
    
    // Update grade options
    updateGradeOptions(schoolType);
    
    // Update subject options
    updateSubjectOptions(schoolType);
});

function updateGradeOptions(schoolType) {
    const gradeOptions = gradeSelect.options;
    
    // Clear existing options
    while (gradeOptions.length > 0) {
        gradeOptions.remove(0);
    }
    
    // Add appropriate options based on school type
    const maxGrade = schoolType === 'primary' ? 6 : 3;
    for (let i = 1; i <= maxGrade; i++) {
        const option = new Option(`${i}年级`, i.toString());
        gradeOptions.add(option);
    }
    
    gradeSelect.selectedIndex = 0;
}

function updateSubjectOptions(schoolType) {
    const subjectOptions = subjectSelect.options;
    
    // Clear existing options
    while (subjectOptions.length > 0) {
        subjectOptions.remove(0);
    }
    
    // Add new options based on school type
    schoolSubjects[schoolType].forEach(subject => {
        const option = new Option(subject.text, subject.value);
        subjectOptions.add(option);
    });
    
    subjectSelect.selectedIndex = 0;
}

// Initialize options on page load
document.addEventListener('DOMContentLoaded', () => {
    // ...existing initialization code...
    
    // Initialize grade and subject options based on default school type
    const defaultSchoolType = schoolSelect.value;
    updateGradeOptions(defaultSchoolType);
    updateSubjectOptions(defaultSchoolType);
});

// ...rest of existing code...

async function showQuizResults() {
    if (score.answered === score.total) {
        const percentage = Math.round((score.correct / score.total) * 100);
        
        // Clean up any existing results first
        while (scoreDisplay.firstChild) {
            scoreDisplay.firstChild.remove();
        }
        
        // Show basic score
        const scoreTextElement = document.createElement('div');
        scoreTextElement.className = 'score-text';
        scoreTextElement.textContent = `最终得分: ${score.correct}/${score.total} (${percentage}%)`;
        scoreDisplay.appendChild(scoreTextElement);
        
        // Show feedback button
        const analyzeBtn = document.createElement('button');
        analyzeBtn.id = 'analyze-btn';
        analyzeBtn.className = 'analyze-btn';
        analyzeBtn.textContent = '评估表现';
        analyzeBtn.onclick = analyzeQuizResults;
        scoreDisplay.appendChild(analyzeBtn);
        
        scoreDisplay.style.display = 'block';
    }
}

function displayAnalysisResults(analysis) {
    // Clean up the text
    const cleanedAnalysis = analysis
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[一二三四五]、/g, '')
        .replace(/^\d+\.\s*/gm, '')
        .trim();

    return `
        <div class="analysis-section">
            <h4>答题成绩总结</h4>
            <div class="analysis-content">
                ${parseAnalysisContent(cleanedAnalysis)}
            </div>
        </div>
    `;
}

function parseAnalysisContent(text) {
    // Split text into paragraphs and filter out empty lines
    const paragraphs = text.split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    // Convert paragraphs to HTML points
    return paragraphs.map(paragraph => {
        // Clean up the paragraph
        const cleanedPoint = paragraph
            .replace(/^[【\[［].+?[】\]］][:：]?\s*/, '')
            .replace(/^[•\-]\s*/, '')
            .split(/[。！？]/)
            .filter(sentence => sentence.trim().length > 0)
            .join('。');

        return `<div class="analysis-point">${cleanedPoint}</div>`;
    }).join('');
}

// Add sidebar navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    const quizContainer = document.querySelector('.quiz-section-container');
    const chatInterface = document.querySelector('.chat-interface');
    const chatInput = document.querySelector('.chat-input');
    const chatSubmit = document.querySelector('.chat-submit');
    const chatResponse = document.querySelector('.chat-response');

    // Sidebar navigation
    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const section = btn.dataset.section;
            if (section === 'quiz') {
                quizContainer.style.display = 'block';
                chatInterface.style.display = 'none';
            } else if (section === 'chat') {
                quizContainer.style.display = 'none';
                chatInterface.style.display = 'block';
            }
        });
    });

    // Chat functionality
    chatSubmit.addEventListener('click', async () => {
        const question = chatInput.value.trim();
        if (!question) {
            alert('请输入问题');
            return;
        }

        try {
            chatSubmit.disabled = true;
            chatSubmit.textContent = '正在处理...';
            chatResponse.innerHTML = '<div class="loading-spinner"></div>';

            const response = await fetch(currentConfig.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: currentConfig.model,
                    messages: [
                        {
                            role: "system",
                            content: `你是一位智慧、耐心且充满热情的AI教师助手，你的目标是帮助学生有效地学习。

作为一名教师，你应该：
- 使用温暖友好的语气，让学生感到提问是安全和舒适的
- 保持鼓励和积极的态度，特别是当学生遇到困难时
- 根据学生的年级和背景知识调整你的解释
- 将复杂概念分解成更简单、易于理解的部分
- 使用与学生日常生活相关的例子和类比
- 肯定学生的进步和理解上的小胜利

回答问题时，请遵循以下结构：
1. 首先，简要确认你理解了问题
2. 对问题进行详细的分析，一步步引导学生，帮助学生理解问题的本质和重要概念
3. 提供清晰、全面的答案，直接解决问题
4. 使用具体例子来说明概念
5. 在适当的情况下，建议学生可能感兴趣的相关主题
6. 以鼓励的话语结束，邀请学生提出后续问题

你的沟通风格应该：
- 使用简单明了的语言
- 保持对话自然，不过于正式
- 在需要时提出澄清问题
- 对重复的问题保持耐心
- 对学生的学习之旅表现出真诚的兴趣

记住，你的目标不仅是提供答案，还要培养理解力、好奇心和学习自信心。始终保持支持和鼓励的语气，让学生感到有能力并有动力继续学习。`
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error('API请求失败');
            }

            const data = await response.json();
            const answer = data.choices[0].message.content;
            
            // 创建回答容器，包含朗读按钮和回答内容
            const answerContainer = document.createElement('div');
            answerContainer.className = 'answer-container';
            
            // 创建语音控制容器
            const speechControls = document.createElement('div');
            speechControls.className = 'speech-controls';
            
            // 创建朗读按钮
            const speakerButton = document.createElement('button');
            speakerButton.className = 'speaker-btn';
            speakerButton.innerHTML = '<i class="fas fa-volume-up"></i> 朗读回答';
            speakerButton.title = "语音朗读回答内容";
            
            // 将朗读按钮添加到语音控制容器
            speechControls.appendChild(speakerButton);
            
            // 创建回答文本元素
            const answerText = document.createElement('div');
            answerText.className = 'answer-text';
            answerText.textContent = answer;
            
            // 将语音控制和回答文本添加到回答容器
            answerContainer.appendChild(speechControls);
            answerContainer.appendChild(answerText);
            
            // 显示回答容器
            chatResponse.innerHTML = '';
            chatResponse.appendChild(answerContainer);
            
            // 添加朗读按钮点击事件
            speakerButton.addEventListener('click', function() {
                // 停止任何正在进行的朗读
                window.speechSynthesis.cancel();
                
                // 更新按钮状态
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备中...';
                this.disabled = true;
                
                // 延迟一下再开始朗读，确保之前的朗读已停止
                setTimeout(() => {
                    speakText(answer);
                }, 100);
            });
            
        } catch (error) {
            chatResponse.textContent = `错误: ${error.message}`;
        } finally {
            chatSubmit.disabled = false;
            chatSubmit.textContent = '提交问题';
        }
    });
});

// 修改语音合成函数，使声音更自然
function speakText(text) {
    // 检查浏览器是否支持语音合成
    if ('speechSynthesis' in window) {
        // 先停止任何正在进行的朗读
        window.speechSynthesis.cancel();
        
        // 预处理文本，添加自然停顿和语调变化
        const processedText = processTextForNaturalSpeech(text);
        
        // 创建语音合成实例
        const speech = new SpeechSynthesisUtterance();
        speech.text = processedText;
        speech.lang = 'zh-CN';
        speech.rate = 0.9;  // 稍微降低语速，使其更自然
        speech.pitch = 1.05; // 略微提高音调，女声听起来更自然
        speech.volume = 1.0; // 音量
        
        // 获取语音列表
        let voices = window.speechSynthesis.getVoices();
        
        // 如果语音列表为空，等待加载
        if (voices.length === 0) {
            // 添加加载提示
            const speakerBtn = document.querySelector('.speaker-btn');
            if (speakerBtn) {
                speakerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载语音...';
                speakerBtn.disabled = true;
            }
            
            // 等待语音列表加载
            window.speechSynthesis.onvoiceschanged = function() {
                voices = window.speechSynthesis.getVoices();
                selectVoiceAndSpeak(speech, voices);
            };
        } else {
            selectVoiceAndSpeak(speech, voices);
        }
        
        // 添加停止按钮
        addStopButton();
    } else {
        alert('您的浏览器不支持语音合成功能');
    }
}

// 预处理文本，使朗读更自然
function processTextForNaturalSpeech(text) {
    // 1. 替换特殊符号为停顿
    let processed = text
        .replace(/([，,])/g, '$1<break time="200ms"/>') // 短停顿
        .replace(/([。.])/g, '$1<break time="400ms"/>') // 中停顿
        .replace(/([！!?？])/g, '$1<break time="500ms"/>') // 长停顿
        .replace(/([：:；;])/g, '$1<break time="300ms"/>') // 中短停顿
        .replace(/(\n\n)/g, '<break time="800ms"/>') // 段落停顿
        .replace(/(\n)/g, '<break time="400ms"/>'); // 换行停顿
    
    // 2. 添加SSML标记以增强表现力（某些浏览器支持）
    processed = `<speak>${processed}</speak>`;
    
    // 3. 如果浏览器不支持SSML，移除标签但保留停顿
    if (!isSsmlSupported()) {
        processed = processed
            .replace(/<speak>/g, '')
            .replace(/<\/speak>/g, '')
            .replace(/<break time="(\d+)ms"\/>/g, '，'); // 用逗号替代停顿标记
    }
    
    return processed;
}

// 检查浏览器是否支持SSML
function isSsmlSupported() {
    // 目前大多数浏览器不完全支持SSML，返回false
    return false;
}

// 选择最佳声音并开始朗读
function selectVoiceAndSpeak(speech, voices) {
    // 定义优先级顺序的声音
    const preferredVoices = [
        // 微软中文女声 - 非常自然
        { nameContains: ['Microsoft', 'Xiaoxiao'], langContains: ['zh'], gender: 'female' },
        { nameContains: ['Microsoft', 'Yaoyao'], langContains: ['zh'], gender: 'female' },
        { nameContains: ['Microsoft', 'Huihui'], langContains: ['zh'], gender: 'female' },
        
        // 谷歌中文女声
        { nameContains: ['Google', '普通话'], langContains: ['zh'], gender: 'female' },
        { nameContains: ['Google', 'Chinese'], langContains: ['zh'], gender: 'female' },
        
        // 苹果中文女声
        { nameContains: ['Ting-Ting'], langContains: ['zh'], gender: 'female' },
        { nameContains: ['Tian-Tian'], langContains: ['zh'], gender: 'female' },
        
        // 任何中文女声
        { nameContains: [], langContains: ['zh', 'cmn'], gender: 'female' },
        
        // 任何中文声音
        { nameContains: [], langContains: ['zh', 'cmn'], gender: '' }
    ];
    
    // 记录所有可用的声音
    console.log('可用的语音列表:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
    
    // 尝试按优先级查找声音
    let selectedVoice = null;
    
    for (const pref of preferredVoices) {
        // 查找匹配的声音
        const matchingVoice = voices.find(voice => {
            const nameMatch = pref.nameContains.length === 0 || 
                              pref.nameContains.some(name => voice.name.includes(name));
            const langMatch = pref.langContains.some(lang => voice.lang.includes(lang));
            const genderMatch = pref.gender === '' || 
                               (voice.name.toLowerCase().includes(pref.gender.toLowerCase()));
            
            return nameMatch && langMatch && genderMatch;
        });
        
        if (matchingVoice) {
            selectedVoice = matchingVoice;
            console.log(`选择语音: ${selectedVoice.name} (${selectedVoice.lang})`);
            break;
        }
    }
    
    // 如果没有找到匹配的声音，使用默认声音
    if (!selectedVoice) {
        console.log('未找到合适的中文声音，使用默认声音');
    } else {
        speech.voice = selectedVoice;
    }
    
    // 根据选择的声音调整参数
    if (selectedVoice) {
        // 微软声音通常需要较慢的语速
        if (selectedVoice.name.includes('Microsoft')) {
            speech.rate = 0.85;
        }
        // 谷歌声音通常需要中等语速
        else if (selectedVoice.name.includes('Google')) {
            speech.rate = 0.95;
        }
    }
    
    // 更新按钮状态
    const speakerBtn = document.querySelector('.speaker-btn.speaking') || 
                       document.querySelector('.speaker-btn:disabled');
    if (speakerBtn) {
        speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i> 正在朗读...';
        speakerBtn.disabled = true;
        speakerBtn.classList.add('speaking');
    }
    
    // 处理朗读结束事件
    speech.onend = handleSpeechEnd;
    speech.onerror = handleSpeechEnd;
    
    // 开始朗读前先取消所有正在进行的朗读
    window.speechSynthesis.cancel();
    
    // 确保语音合成服务处于活动状态
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
    }
    
    // 开始朗读
    window.speechSynthesis.speak(speech);
    
    // 解决Chrome的语音合成bug
    keepSpeechAlive(speech);
}

// 修改获取分析文本的函数，优化朗读内容
function getAnalysisTextForSpeech(analysisElement) {
    // 提取所有分析点
    const analysisPoints = analysisElement.querySelectorAll('.analysis-point');
    let speechText = "以下是您的测验分析结果。\n\n";
    
    // 添加得分信息
    const scoreText = document.querySelector('.score-text');
    if (scoreText) {
        const score = scoreText.textContent.trim();
        speechText += `${score}。\n\n`;
        
        // 根据分数添加鼓励性评语
        const scoreValue = parseInt(score.match(/\d+/)[0] || 0);
        if (scoreValue >= 90) {
            speechText += "恭喜您取得了优秀的成绩！您的表现非常出色。\n\n";
        } else if (scoreValue >= 80) {
            speechText += "您的表现很好，继续保持！\n\n";
        } else if (scoreValue >= 60) {
            speechText += "您已经通过了测验，但还有提升的空间。\n\n";
        } else {
            speechText += "这次测验有些困难，不要灰心，我们一起来看看需要改进的地方。\n\n";
        }
    }
    
    // 添加每个分析点
    analysisPoints.forEach((point, index) => {
        // 清理文本，移除多余空格和HTML标签
        const cleanText = point.textContent.trim()
            .replace(/\s+/g, ' ')
            .replace(/<[^>]*>/g, '');
            
        speechText += `第${index + 1}点：${cleanText}。\n\n`;
    });
    
    // 添加结束语
    speechText += "分析结束，希望这些建议对您有所帮助。祝您学习进步！";
    
    return speechText;
}

// 确保在页面加载时预加载语音列表
document.addEventListener('DOMContentLoaded', function() {
    if ('speechSynthesis' in window) {
        // 强制加载语音列表
        window.speechSynthesis.getVoices();
        
        // 在某些浏览器中，需要监听voiceschanged事件
        window.speechSynthesis.addEventListener('voiceschanged', function() {
            console.log('语音列表已加载:', window.speechSynthesis.getVoices().length);
        });
    }
});

// 添加缺失的函数
// 处理朗读结束
function handleSpeechEnd() {
    // 恢复按钮状态
    const speakerBtn = document.querySelector('.speaker-btn.speaking') || 
                       document.querySelector('.speaker-btn:disabled');
    if (speakerBtn) {
        // 根据按钮所在位置设置不同的文本
        if (speakerBtn.closest('.analysis-results')) {
            speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i> 朗读分析';
        } else if (speakerBtn.closest('.answer-container')) {
            speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i> 朗读回答';
        } else {
            speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i> 朗读';
        }
        
        speakerBtn.disabled = false;
        speakerBtn.classList.remove('speaking');
    }
    
    // 移除停止按钮
    const stopBtn = document.querySelector('.stop-speech-btn');
    if (stopBtn) {
        stopBtn.remove();
    }
}

// 添加停止按钮
function addStopButton() {
    // 移除已存在的停止按钮
    const existingStopBtn = document.querySelector('.stop-speech-btn');
    if (existingStopBtn) {
        existingStopBtn.remove();
    }
    
    // 创建新的停止按钮
    const stopBtn = document.createElement('button');
    stopBtn.className = 'stop-speech-btn';
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> 停止朗读';
    stopBtn.title = "停止语音朗读";
    
    // 添加点击事件
    stopBtn.addEventListener('click', function() {
        window.speechSynthesis.cancel();
        handleSpeechEnd();
    });
    
    // 查找当前活动的朗读按钮
    const activeSpeakerBtn = document.querySelector('.speaker-btn.speaking');
    
    // 将按钮添加到正确的位置
    if (activeSpeakerBtn && activeSpeakerBtn.parentNode) {
        // 如果是在语音控制容器中，直接添加到容器
        if (activeSpeakerBtn.parentNode.classList.contains('speech-controls')) {
            activeSpeakerBtn.parentNode.appendChild(stopBtn);
        } else {
            // 否则添加到按钮后面
            activeSpeakerBtn.parentNode.insertBefore(stopBtn, activeSpeakerBtn.nextSibling);
        }
    }
}

// 改进keepAlive函数，使其更可靠
function keepSpeechAlive(speech) {
    const synth = window.speechSynthesis;
    let intervalId;
    
    // 每10秒检查一次，如果正在朗读，则暂停并恢复以保持活动状态
    intervalId = setInterval(() => {
        if (!synth.speaking) {
            clearInterval(intervalId);
            return;
        }
        
        synth.pause();
        synth.resume();
    }, 10000);
    
    // 当朗读结束时清除定时器
    const originalOnEnd = speech.onend;
    speech.onend = function() {
        clearInterval(intervalId);
        if (originalOnEnd) originalOnEnd.call(speech);
        handleSpeechEnd();
    };
    
    const originalOnError = speech.onerror;
    speech.onerror = function() {
        clearInterval(intervalId);
        if (originalOnError) originalOnError.call(speech);
        handleSpeechEnd();
    };
}
