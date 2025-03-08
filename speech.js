document.addEventListener('DOMContentLoaded', function() {
    // 确保聊天控件容器存在
    const chatControls = document.querySelector('.chat-controls');
    if (!chatControls) {
        console.error('找不到聊天控件容器');
        return;
    }
    
    // 查找现有的麦克风按钮
    let voiceButton = chatControls.querySelector('.voice-input-btn');
    
    // 如果麦克风按钮不存在，创建一个
    if (!voiceButton) {
        voiceButton = document.createElement('button');
        voiceButton.className = 'voice-input-btn';
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceButton.title = "语音输入";
        chatControls.appendChild(voiceButton);
    }
    
    // 查找聊天输入框
    const chatInput = document.querySelector('.chat-input');
    if (!chatInput) {
        console.error('找不到聊天输入框');
        return;
    }
    
    // 检查浏览器是否支持语音识别
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        // 初始化语音识别
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        // 改进配置以提高准确性
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3; // 获取多个可能的结果
        
        // 设置为中文，因为自动检测不够准确
        recognition.lang = 'zh-CN';
        
        let isListening = false;
        
        // 添加状态指示文本
        const statusText = document.createElement('span');
        statusText.className = 'voice-status';
        statusText.textContent = '准备就绪';
        statusText.style.display = 'none';
        
        // 创建语言选择下拉菜单
        const langSelect = document.createElement('select');
        langSelect.className = 'lang-select';
        langSelect.title = "选择语音识别语言";
        
        // 添加语言选项
        const languages = [
            { code: 'zh-CN', name: '中文' },
            { code: 'en-US', name: 'English' },
            { code: 'ja-JP', name: '日本語' },
            { code: 'ko-KR', name: '한국어' }
        ];
        
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;
            langSelect.appendChild(option);
        });
        
        // 将状态文本添加到控件容器
        chatControls.appendChild(statusText);
        
        // 语言选择事件处理
        langSelect.addEventListener('change', function() {
            recognition.lang = this.value;
            statusText.textContent = `已切换为${languages.find(l => l.code === this.value).name}识别`;
            statusText.style.display = 'inline-block';
            
            // 2秒后隐藏提示
            setTimeout(() => {
                if (!isListening) {
                    statusText.style.display = 'none';
                }
            }, 2000);
        });
        
        voiceButton.addEventListener('click', function() {
            if (!isListening) {
                // 开始监听
                recognition.start();
                voiceButton.classList.add('listening');
                voiceButton.querySelector('i').classList.remove('fa-microphone');
                voiceButton.querySelector('i').classList.add('fa-stop');
                voiceButton.title = "点击停止";
                statusText.textContent = '正在聆听...';
                statusText.style.display = 'inline-block';
                
                // 添加波纹动画效果
                voiceButton.classList.add('ripple');
            } else {
                // 停止监听
                recognition.stop();
                voiceButton.classList.remove('listening');
                voiceButton.querySelector('i').classList.remove('fa-stop');
                voiceButton.querySelector('i').classList.add('fa-microphone');
                voiceButton.title = "语音输入";
                statusText.style.display = 'none';
                
                // 移除波纹动画效果
                voiceButton.classList.remove('ripple');
            }
            
            isListening = !isListening;
        });
        
        // 处理语音识别结果
        recognition.onresult = function(event) {
            // 获取最可能的结果
            const transcript = event.results[0][0].transcript;
            
            // 如果有多个结果，选择置信度最高的
            let bestTranscript = transcript;
            let bestConfidence = event.results[0][0].confidence;
            
            for (let i = 1; i < event.results[0].length; i++) {
                if (event.results[0][i].confidence > bestConfidence) {
                    bestTranscript = event.results[0][i].transcript;
                    bestConfidence = event.results[0][i].confidence;
                }
            }
            
            // 将识别结果添加到输入框
            if (chatInput) {
                chatInput.value = bestTranscript;
                
                // 触发输入事件，确保任何监听输入变化的代码都能响应
                const inputEvent = new Event('input', { bubbles: true });
                chatInput.dispatchEvent(inputEvent);
                
                // 聚焦输入框，方便用户继续编辑
                chatInput.focus();
            } else {
                console.error('无法找到聊天输入框来设置识别结果');
            }
            
            statusText.textContent = '已识别';
        };
        
        // 处理语音输入结束
        recognition.onend = function() {
            voiceButton.classList.remove('listening');
            voiceButton.classList.remove('ripple');
            voiceButton.querySelector('i').classList.remove('fa-stop');
            voiceButton.querySelector('i').classList.add('fa-microphone');
            voiceButton.title = "语音输入";
            statusText.textContent = '已完成';
            
            // 3秒后隐藏状态文本
            setTimeout(() => {
                statusText.style.display = 'none';
            }, 3000);
            
            isListening = false;
        };
        
        // 处理错误
        recognition.onerror = function(event) {
            console.error('Speech recognition error', event.error);
            voiceButton.classList.remove('listening');
            voiceButton.classList.remove('ripple');
            voiceButton.querySelector('i').classList.remove('fa-stop');
            voiceButton.querySelector('i').classList.add('fa-microphone');
            voiceButton.title = "语音输入";
            
            // 显示错误信息
            statusText.textContent = '出错了: ' + event.error;
            statusText.style.display = 'inline-block';
            statusText.classList.add('error');
            
            // 3秒后隐藏错误信息
            setTimeout(() => {
                statusText.style.display = 'none';
                statusText.classList.remove('error');
            }, 3000);
            
            isListening = false;
        };
        
    } else {
        // 浏览器不支持语音识别
        voiceButton.style.display = 'none';
        console.log('Speech recognition not supported in this browser');
        
        // 添加不支持提示
        const unsupportedMsg = document.createElement('span');
        unsupportedMsg.className = 'voice-unsupported';
        unsupportedMsg.textContent = '您的浏览器不支持语音输入';
        document.querySelector('.chat-controls').appendChild(unsupportedMsg);
    }
});