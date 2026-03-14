// utils/excelParser.js
const XLSX = require('./xlsx.full.min.js');
import { saveExcelData, loadExcelData, hasExcelData } from './storage.js';

/**
 * 
 * 读取Excel文件并存储
 * @param {string} filePath 临时文件路径
 * @param {string} storageKey 存储键名
 * @returns {Promise} 包含所有Excel数据的对象
 */
export async function readAndSaveExcel(filePath, fileName = 'file_data') {
    const fs = wx.getFileSystemManager();
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const timestamp = Date.now();
    const storageKey = `${fileExtension}Data_${fileName}_${timestamp}`;

    // 1. 定义编码映射
    const encoding = ['xls', 'xlsx'].includes(fileExtension) ? 'binary' : 'utf8';

    try {
        // 2. 统一读取文件内容
        const res = await new Promise((resolve, reject) => {
            fs.readFile({
                filePath,
                encoding,
                success: resolve,
                fail: (err) => reject(new Error(`读取失败: ${err.errMsg}`))
            });
        });

        let rawData;
        let content = res.data;

        // 3. 根据类型分发解析逻辑
        if (['xls', 'xlsx'].includes(fileExtension)) {
            rawData = parseExcelContent(content);
        } else if (['txt', 'txts'].includes(fileExtension)) {
            rawData = parseTxtContent(content);
        } else if (fileExtension === 'json') {
            rawData = parseJsonContent(content);
        } else {
            throw new Error('不支持的文件格式: ' + fileExtension);
        }

        // 4. 统一注入元数据
        rawData.displayName = extractFileName(storageKey);
        rawData.storageKey = storageKey;

        // 5. 统一执行保存
        if (saveExcelData(storageKey, rawData)) {
            console.log(`${fileExtension} 数据已成功保存`);
        }
        console.log(rawData)
        return rawData;

    } catch (error) {
        console.error("文件处理链路异常:", error);
        throw error; // 抛出错误供 UI 层捕获显示
    }
}
/** * --- 辅助解析函数：Excel ---
 */
function parseExcelContent(binaryData) {
    // 将二进制串转为 Uint8Array
    const data = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; ++i) {
        data[i] = binaryData.charCodeAt(i) & 0xFF;
    }

    const workbook = XLSX.read(data, { type: 'array' });
    const resultSheets = {};
console.log(workbook)
    workbook.SheetNames.forEach(name => {
        const worksheet = workbook.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
        resultSheets[name] = {
            rawData: jsonData,
            rowCount: jsonData.length,
            colCount: jsonData[0] ? jsonData[0].length : 0
        };
    });

    return prepareAllSheets(resultSheets, workbook.SheetNames);
}

/** * --- 辅助解析函数：TXT ---
 */
function parseTxtContent(content) {
    // 处理 UTF-8 BOM
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return parseTxtToQuestions(cleanContent);
}

/** * --- 辅助解析函数：JSON ---
 */
function parseJsonContent(content) {
    const data = JSON.parse(content);
    if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('JSON题库格式不规范：缺少 questions 数组');
    }
    return data;
}

export function greadAndSaveExcel(filePath, fileName = 'file_data') {
    return new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager();      
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const timestamp = Date.now();
        const storageKey = `${fileExtension}Data_${fileName}_${timestamp}`;

        if (['xls', 'xlsx'].includes(fileExtension)) {
            fs.readFile({
                filePath: filePath,
                encoding: 'binary',
                success: (res) => {
                    try {
                        // 根据文件扩展名选择不同的解析方式

                        // 处理Excel文件
                        // 将二进制字符串转换为Uint8Array
                        const data = new Uint8Array(res.data.length);
                        for (let i = 0; i < res.data.length; ++i) {
                            data[i] = res.data.charCodeAt(i) & 0xFF;
                        }

                        // 使用SheetJS解析Excel
                        const workbook = XLSX.read(data, { type: 'array' });
                        
                        // 构建返回的数据结构
                        const result = {
                            fileType: 'excel',
                            sheetNames: workbook.SheetNames,
                            sheetCount: workbook.SheetNames.length,
                            sheets: {},
                            timestamp: new Date().getTime(), // 添加时间戳
                            fileName: fileName.split('/').pop() // 文件名
                        };

                        // 遍历每个工作表，读取数据
                        workbook.SheetNames.forEach(sheetName => {
                            const worksheet = workbook.Sheets[sheetName];
                            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                                header: 1,
                                defval: '',
                                raw: false
                            });

                            result.sheets[sheetName] = {
                                rawData: jsonData,
                                rowCount: jsonData.length,
                                colCount: jsonData[0] ? jsonData[0].length : 0,
                                range: worksheet['!ref'] || 'A1'
                            };
                        });

                        // 初始化全量题目
                        //const rawData = prepareQuestions(result.sheets[result.sheetNames[0]].rawData, headers);
                        const rawData = prepareAllSheets(result.sheets, result.sheetNames);                        
                        rawData.displayName = extractFileName(storageKey);                        
                        rawData.storageKey = storageKey;

                        // 存储到本地
                        if (saveExcelData(storageKey, rawData)) {
                            console.log('Excel数据已保存到本地存储');
                        }

                        resolve(rawData);
                    } catch (error) {
                        reject(new Error('解析Excel文件失败: ' + error.message));
                    }
                },
                fail: (err) => {
                    reject(new Error('读取文件失败: ' + err.errMsg));
                }
            });
        } else if (['txt', 'txts'].includes(fileExtension)) {
            fs.readFile({
                filePath: filePath,
                encoding: 'utf8',
                success: (res) => {
                    try {
                        let content = res.data;

                        // 处理 UTF-8 BOM 头 (去除开头的不可见字符 \ufeff)
                        if (content.charCodeAt(0) === 0xFEFF) {
                            content = content.slice(1);
                        }
                        
                        let rawData = parseTxtToQuestions(content);
                        rawData.displayName = extractFileName(storageKey);
                        rawData.storageKey = storageKey;

                        if (saveExcelData(storageKey, rawData)) {
                            console.log('txt数据已保存到本地存储');
                        }

                        resolve(rawData);
                    } catch (error) {
                        reject(new Error('解析txt文档失败: ' + error.message));
                    }
                },
                fail: (err) => {
                    console.error('读取失败', err);
                    reject(new Error('txt文件读取失败: ' + err.errMsg));
                }
            });
        } else if (['json'].includes(fileExtension)) {
            fs.readFile({
                filePath: filePath,
                encoding: 'utf8',
                success: (res) => {
                    try {
                        let content = res.data;
                        const rawData = JSON.parse(content);
                        // 基础格式校验（防止读取了乱七八糟的 JSON）
                        if (!rawData.questions || !Array.isArray(rawData.questions)) {
                            throw new Error('无效的题库格式：缺少题目数据');
                        }
                       
                        rawData.displayName = extractFileName(storageKey);
                        rawData.storageKey = storageKey;

                        if (saveExcelData(storageKey, rawData)) {
                            console.log('JSON数据已保存到本地存储');
                        }

                        wx.showToast({
                            title: 'JSON题库加载成功',
                            icon: 'success'
                        });

                        resolve(rawData);
                    } catch (error) {
                        reject(new Error('解析JSON文档失败: ' + error.message));
                    }
                },
                fail: (err) => {
                    console.error('JSON文档读取失败', err);
                    reject(new Error('JSON文档读取失败: ' + err.errMsg));
                }
            });            
        } else {
            reject(new Error('不支持的文件格式: ' + fileExtension));
        }
    });
}

/**
 * 直接从存储加载Excel数据
 * @param {string} storageKey 存储键名
 * @returns {Object|null} Excel数据
 */
export function loadSavedExcel(storageKey = 'excel_data') {
    return loadExcelData(storageKey);
}

/**
 * 检查是否有存储的Excel数据
 * @param {string} storageKey 存储键名
 * @returns {boolean} 是否存在
 */
export function hasSavedExcel(storageKey = 'excel_data') {
    console.log(storageKey);
    return hasExcelData(storageKey);
}

export function extractFileName(fullName) {
    // 移除开头的 "excel_"
    let result = fullName.replace(/^(xlsData|txtData|txtsData|jsonData)_/, '');
    // 移除结尾的 ".xls_数字"
    result = result.replace(/\.(xls|txt|txts|json)(_\d+)?$/, '');
    return result;
}

export function parseTxtToQuestions(text) {
    const result = {};
    result.questions = [];
    const types = new Set(['全部题型']);

    const lines = text.split('\n');
 
    let questions = [];
    let currentType = "";
    let currentQuestion = null;
    let id = 1;
    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;
        // 识别题型切换
        if (line.includes("填空题")) { currentType = "填空题"; return; }
        if (line.includes("单项选择题")) { currentType = "单选题"; return; }
        if (line.includes("判断题")) { currentType = "判断题"; return; }
        if (line.includes("问答题")) { currentType = "问答题"; return; }

        // 匹配题目开始 (例如: 1.轮缘润滑...)
        const questionMatch = line.match(/^(\d+)\s*[\.、](.*)/);

        if (questionMatch) {
            // 如果之前有正在处理的题目，先存入数组
            if (currentQuestion) {
                questions.push(currentQuestion);
                id++;
            }

            let content = questionMatch[2];
            let answer = "";

            currentQuestion = {
                id: id,
                type: currentType,
                content: content,
                answer: answer,
                options: { A: "", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" },
                rawIndex: index + 1
            };

            // --- 不同题型的特殊处理 ---
            if (currentType === "单选题" || currentType === "判断题") {
                // 提取括号内的答案：( A ) -> A
                const ansMatch = content.match(/\(\s*([A-I√✓xX✗×])\s*\)/);
                if (ansMatch) {
                    let rawAnswer = ansMatch[1]; // 拿到原始符号
                    // 建立映射关系
                    const map = {
                        '√': 'A', '✓': 'A',
                        'x': 'B', 'X': 'B', '✗': 'B', '×': 'B'
                    };
                    // 如果是勾叉，转为 AB；否则保持 A-I 原样
                    currentQuestion.answer = map[rawAnswer] || rawAnswer;
                    // 将括号内容挖空，保持显示一致性
                    currentQuestion.content = content.replace(/\(\s*[A-I√✓xX✗×]\s*\)/, "(   )");
                }
                if (currentType === "判断题") {
                    currentQuestion.options.A = "正确";
                    currentQuestion.options.B = "错误";
                }
            } else if (currentType === "填空题") {
                /**
                 * 正则逻辑说明：
                 * \s+          : 匹配前导空格
                 * ([^\s，。：]+) : 捕获组：匹配非空格、非标点的字符（即答案内容）
                 * (?=\s+)      : 断言：后面必须紧跟至少一个空格
                 */
                const spaceEmptyMatch = content.match(/\s+([^\s，。：]+)(?=\s+)/);
                let answerText = "";
                if (spaceEmptyMatch) {
                    answerText = spaceEmptyMatch[1]; // 提取出空格中间的字符
                    // 将原内容中的该部分替换为统一的下划线
                    currentQuestion.content = content.replace(spaceEmptyMatch[1], "______");
                } else {
                    // 如果没找到空格包围的，尝试找末尾的数字（作为保底逻辑）
                    const endNumMatch = content.match(/(\d+[\d\-\.~/]*\d*)$/);
                    if (endNumMatch) {
                        answerText = endNumMatch[1];
                        currentQuestion.content = content.replace(endNumMatch[1], "______");
                    }
                }
                currentQuestion.options.A = answerText || "（未识别到答案）";
            }
        }
        // 匹配单选题选项 (A.22 B.23...)
        else if (currentType === "单选题" && currentQuestion) {
            const optionsMatch = line.match(/([A-I])[\.、]\s*([^A-I]+?(?=\s+[A-I][\.、]|\s*$))/g);
            if (optionsMatch) {
                optionsMatch.forEach(optStr => {
                    const match = optStr.match(/([A-I])[\.、]\s*(.+)/);
                    if (match) {
                        const label = match[1];
                        const text = match[2].trim();
                        currentQuestion.options[label] = text;
                    }
                });
            }
        }
        // 匹配问答题答案
        else if (currentType === "问答题" && currentQuestion && line.startsWith("答:")) {
            currentQuestion.options.A = line.replace("答:", "").trim();
        }
        // 处理多行内容（如果题目描述分行了）
        else if (currentType === "问答题" && currentQuestion) {
            if (currentQuestion.options.A) {
                currentQuestion.options.A += "\n" + line;
            }
        }

        if (currentQuestion?.type) types.add(currentQuestion.type);
    });

    // 最后一题压入
    if (currentQuestion) questions.push(currentQuestion);
    result.questions = questions;
    result.questionTypes = Array.from(types);
    return result;
}

// 表头解析函数
export function parseExcelHeaders(rawData) {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;

    const headers = {};
    
    const columnKeywords = {
        questionNumber: ['题号', '序号', '编号', 'number', 'id'],
        questionType: ['题型', '试题题型', '题型名', '题目类型', '类型', '题类'],
        questionContent: ['题目', '题干', '内容', '试题内容', '问题', 'question', '试题内容'],
        difficulty: ['难度', '难易度', 'difficulty'],
        correctAnswer: ['答案', '标准答案', '正确答案', '正确选项', 'answer'],
        optionA: ['选项A', 'A选项', 'A', 'Ａ'],
        optionB: ['选项B', 'B选项', 'B', 'Ｂ'],
        optionC: ['选项C', 'C选项', 'C', 'Ｃ'],
        optionD: ['选项D', 'D选项', 'D', 'Ｄ'],
        optionE: ['选项E', 'E选项', 'E', 'Ｅ'],
        optionF: ['选项F', 'F选项', 'F', 'Ｆ'],
        optionG: ['选项G', 'G选项', 'G', 'Ｇ'],
        optionH: ['选项H', 'H选项', 'H', 'Ｈ'],
        optionI: ['选项I', 'I选项', 'I', 'Ｉ']
    };

    let headerRow = null;
    let headerRowIndex = -1;

    // 1. 寻找表头行：降低门槛
    // 只要一行中同时包含“内容相关”和“答案相关”的关键词，我们就认定它是表头
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;

        let hasContentKey = false;
        let hasAnswerKey = false;
        let hasNumberKey = false;

        row.forEach(cell => {
            if (cell === undefined || cell === null) return;
            const cellText = cell.toString().toLowerCase().trim();

            // 检查内容关键词
            if (!hasContentKey) {
                hasContentKey = columnKeywords.questionContent.some(k => cellText === k.toLowerCase() || cellText.includes(k.toLowerCase()));
            }
            // 检查答案关键词
            if (!hasAnswerKey) {
                hasAnswerKey = columnKeywords.correctAnswer.some(k => cellText === k.toLowerCase() || cellText.includes(k.toLowerCase()));
            }
            // 检查序号关键词 (作为辅助判定)
            if (!hasNumberKey) {
                hasNumberKey = columnKeywords.questionNumber.some(k => cellText === k.toLowerCase() || cellText.includes(k.toLowerCase()));
            }
        });

        // 【核心修改点】：判定逻辑调整
        // 逻辑：(有题干 && 有答案) 或者 (有题干 && 有序号) 即可认定为表头
        if (hasContentKey && (hasAnswerKey || hasNumberKey)) {
            headerRow = row;
            headerRowIndex = i;
            break;
        }
    }

    if (!headerRow) return null;

    // 安全的查找函数
    function findColumnIndex(row, keywords) {
        if (!row || !Array.isArray(keywords)) return -1;
        return row.findIndex(cell => {
            if (cell === undefined || cell === null) return false;
            const cellText = cell.toString().toLowerCase().trim();
            // 优先完全匹配，其次包含匹配
            return keywords.some(k => cellText === k.toLowerCase()) || 
                   keywords.some(k => cellText.includes(k.toLowerCase()));
        });
    };

    // 2. 映射所有找到的索引
    for (const [key, keywords] of Object.entries(columnKeywords)) {
        const index = findColumnIndex(headerRow, keywords);
        if (index !== -1) {
            headers[key] = index;
        }
    }

    headers["start"] = headerRowIndex;
    return headers;
}

// 根据表头解释题目
export function prepareAllSheets(sheets, sheetNames) {
    const finalResult = {
        questions: [],
        questionTypes: new Set(['全部题型'])
    };
    let globalIdCounter = 1;

    sheetNames.forEach(sheetName => {
        const sheetData = sheets[sheetName].rawData;
        if (!sheetData || sheetData.length === 0) return;

        const currentHeaders = parseExcelHeaders(sheetData);
        if (!currentHeaders || currentHeaders.questionContent === undefined) return;

        for (let i = currentHeaders.start + 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            if (!row || row.length === 0 || !row[currentHeaders.questionContent]) continue;

            // 1. 确定题型（优先取行内题型，无则取 Sheet 名）
            let qType = row[currentHeaders.questionType] || sheetName;
            qType = String(qType).trim();

            const qObj = {
                id: globalIdCounter++,
                type: qType,
                content: String(row[currentHeaders.questionContent]).trim(),
                answer: row[currentHeaders.correctAnswer] ? String(row[currentHeaders.correctAnswer]).trim() : '',
                options: {}, 
                sheetName: sheetName,
                rawIndex: i
            };

            // 2. 动态填充选项
            const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
            let hasFoundOriginalOptions = false;

            optionKeys.forEach(key => {
                const colIndex = currentHeaders[`option${key}`];
                // 只有当表头里定义了该选项列，且该行对应位置有值时才填充
                if (colIndex !== undefined && colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== '') {
                    qObj.options[key] = String(row[colIndex]).trim();
                    hasFoundOriginalOptions = true;
                } else {
                    qObj.options[key] = ''; 
                }
            });

            // --- 核心修改逻辑：如果没有映射到选项 ---
            if (!hasFoundOriginalOptions) {
                // 如果是填空题、简答题等没有 A/B/C/D 的情况
                // 将“正确答案”列的内容作为选项 A 存入，方便 UI 展示
                if (qObj.answer) {
                    qObj.options.A = qObj.answer;
                    // 如果是判断题且没有选项，可以根据答案反推补全
                    if (qType.includes('判断')) {
                        qObj.options.B = (qObj.answer === '正确' || qObj.answer === '√') ? '错误' : '正确';
                    }
                }
            }

            finalResult.questions.push(qObj);
            finalResult.questionTypes.add(qType);
        }
    });

    finalResult.questionTypes = Array.from(finalResult.questionTypes);
    return finalResult;
}