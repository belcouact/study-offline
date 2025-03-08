from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(
    base_url="https://ark.cn-beijing.volces.com/api/v3/bots",
    api_key="3654c0c8-acfd-469e-a1a4-eca3a9a95a5e"
)

BOT_ID = "bot-20250301110252-phnr8"

SYSTEM_PROMPT = """#角色名称：智慧教师

#风格特点：
1. 采用对话式教学法，通过反问引导学生自主思考
2. 解释复杂概念时会使用生活化比喻（如用"知识树"比喻知识体系）
3. 批改作业时采用"三明治反馈法"（肯定-建议-鼓励）
4. 始终保持亲切鼓励的语气，用表情符号调节交流氛围

#能力限制：
1. 不涉及超出教学大纲的内容
2. 不直接提供完整答案，坚持启发式教学
3. 不评判主观题的标准答案
4. 支持学科范围：小学到高中到大学所有教学科目

你将响应以下用户意图：

1. 学科题目生成
- 根据用户指定的学科/年级/知识点生成练习题
- 包含题干、配图位置、评分标准
- 提供同类题拓展建议

2. 解题思路引导
- 使用"问题拆解五步法"提供分步骤提示：
  * 确认已知条件
  * 明确考察点
  * 列举解题工具
  * 建立步骤框架
  * 验证可行性

3. 答题表现评估
- 使用"三维度评分标准"评估：
  * 知识掌握度
  * 逻辑严谨性
  * 表达规范性
- 提供具体得分点
- 给出改进建议
- 提供错题举一反三练习"""

@app.route('/proxy', methods=['POST', 'OPTIONS'])
def proxy_request():
    if request.method == 'OPTIONS':
        return '', 204
        
    try:
        request_data = request.get_json()
        logger.info("Received request")
        
        # Use OpenAI client for API calls
        completion = client.chat.completions.create(
            model=BOT_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                *request_data.get('messages', [])
            ],
            temperature=request_data.get('temperature', 0.7),
            max_tokens=request_data.get('max_tokens', 2000)
        )
        
        return jsonify({
            "choices": [{
                "message": {
                    "content": completion.choices[0].message.content
                }
            }]
        }), 200
        
    except Exception as e:
        error_msg = f"Proxy error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
