// utils/excelParser.js
const XLSX = require('./xlsx.full.min.js');
import { saveExcelData, loadExcelData, hasExcelData } from './storage.js';

/**
 * 读取Excel文件并存储
 * @param {string} filePath 临时文件路径
 * @param {string} storageKey 存储键名
 * @returns {Promise} 包含所有Excel数据的对象
 */
export function readAndSaveExcel(filePath, fileName = 'file_data') {
    return new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager();
        const fileExtension = filePath.split('.').pop().toLowerCase();
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
                            fileName: filePath.split('/').pop() // 文件名
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
    // 1. 防御性检查：确保数据存在且不是空数组
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return null;

    const headers = {};
    
    // 定义各列的关键词映射
    const columnKeywords = {
        questionNumber: ['题号', '序号', '编号', 'number', 'id'],
        questionType: ['题型', '题目类型', '类型', '题类'],
        questionContent: ['题目', '题干', '内容', '问题', 'question'],
        difficulty: ['难度', '难易度', 'difficulty'],
        correctAnswer: ['答案', '正确答案', '正确选项', 'answer'],
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
    let headerRowIndex = -1; // 修改：初始化为 -1 方便判断

    // 2. 遍历寻找表头行
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;

        let hasQuestionNumber = false;
        let hasQuestionContent = false;

        row.forEach(cell => {
            if (!cell) return;
            const cellText = cell.toString().toLowerCase().trim();

            if (!hasQuestionNumber) {
                hasQuestionNumber = columnKeywords.questionNumber.some(keyword =>
                    cellText.includes(keyword.toLowerCase())
                );
            }
            if (!hasQuestionContent) {
                hasQuestionContent = columnKeywords.questionContent.some(keyword =>
                    cellText.includes(keyword.toLowerCase())
                );
            }
        });

        if (hasQuestionNumber && hasQuestionContent) {
            headerRow = row;
            headerRowIndex = i;
            break;
        }
    }

    // 3. 微调重点：如果没找到表头，直接返回 null，防止后续 findIndex 报错
    if (!headerRow) return null;

    // 安全的查找函数
    function findColumnIndex(row, keywords) {
        if (!row || !Array.isArray(keywords)) return -1;
        return row.findIndex(cell => {
            if (cell === undefined || cell === null) return false;
            const cellText = cell.toString().toLowerCase().trim();
            return keywords.some(keyword => cellText.includes(keyword.toLowerCase()));
        });
    };

    // 4. 微调：仅遍历 columnKeywords 的 key（不包含 Index 变量）
    for (const [key, keywords] of Object.entries(columnKeywords)) {
        const index = findColumnIndex(headerRow, keywords);
        if (index !== -1) {
            headers[key] = index;
        }
    }

    // 5. 统一数据起始标记
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

        // --- 核心改动：针对当前 Sheet 解析表头 ---
        const currentHeaders = parseExcelHeaders(sheetData);
        
        // 如果该表没搜到表头（比如是个空表或者说明页），直接跳过
        if (!currentHeaders || currentHeaders.questionContent === undefined) return;

        // 使用当前表的 start 索引开始遍历
        for (let i = currentHeaders.start + 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            if (!row || row.length === 0 || !row[currentHeaders.questionContent]) continue;

            const qObj = {
                id: globalIdCounter++,
                type: row[currentHeaders.questionType] || '未知',
                content: row[currentHeaders.questionContent],
                answer: row[currentHeaders.correctAnswer] || '',
                options: {
                    // 使用 currentHeaders 动态映射
                    A: row[currentHeaders.optionA] || '',
                    B: row[currentHeaders.optionB] || '',
                    C: row[currentHeaders.optionC] || '',
                    D: row[currentHeaders.optionD] || '',
                    E: row[currentHeaders.optionE] || '',
                    F: row[currentHeaders.optionF] || '',
                    G: row[currentHeaders.optionG] || '',
                    H: row[currentHeaders.optionH] || '',
                    I: row[currentHeaders.optionI] || ''
                },
                sheetName: sheetName,
                rawIndex: i
            };

            finalResult.questions.push(qObj);
            if (qObj.type) finalResult.questionTypes.add(qObj.type);
        }
    });

    finalResult.questionTypes = Array.from(finalResult.questionTypes);
    return finalResult;
}