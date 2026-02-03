const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../data/questions');

// 映射配置
const RESOURCE_MAP = {
  'ylx_xxzd_1': { subject: '药理学', textbook: '药理学习题指导' }
};

// 中文数字转阿拉伯数字
const chnToNum = (chnStr) => {
  const chnNumChar = { '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
  const chnNameValue = { 
    '十': { value: 10, secUnit: false },
    '百': { value: 100, secUnit: false },
    '千': { value: 1000, secUnit: false },
    '万': { value: 10000, secUnit: true },
    '亿': { value: 100000000, secUnit: true }
  };
  let rtn = 0, section = 0, number = 0, secUnit = false;
  const str = chnStr.split('');
  for(let i = 0; i < str.length; i++){
    let num = chnNumChar[str[i]];
    if(typeof num !== 'undefined'){
      number = num;
    } else {
      let unitNode = chnNameValue[str[i]];
      if(typeof unitNode !== 'undefined'){
        let unit = unitNode.value;
        secUnit = unitNode.secUnit;
        if(secUnit){
          section = (section + number) * unit;
          rtn += section;
          section = 0;
        } else {
          if (number === 0 && unit === 10) number = 1;
          section += (number * unit);
        }
        number = 0;
      }
    }
  }
  return rtn + section + number;
};

// 处理单个文件
function processFile(filename) {
  if (!filename.endsWith('.txt')) return;
  
  const filePath = path.join(srcDir, filename);
  console.log(`Processing ${filename}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 去除 markdown 标记
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // 处理可能存在的 BOM 头或其他不可见字符
  content = content.replace(/^\uFEFF/, '');

  let questions;
  try {
    questions = JSON.parse(content);
  } catch (e) {
    console.error(`Error parsing ${filename}:`, e.message);
    // 尝试简单的修复：如果末尾多了逗号等
    return;
  }
  
  if (!Array.isArray(questions)) {
    console.error(`Error: Content in ${filename} is not an array.`);
    return;
  }

  const processed = questions.map(q => {
    const mapInfo = RESOURCE_MAP[q.resource] || { subject: '未知科目', textbook: '未知教材' };
    
    // 提取章节数字
    const chapterMatch = q.chapter.match(/第(.+)章/);
    const chapterNum = chapterMatch ? chnToNum(chapterMatch[1]) : 0;
    
    // 格式化 ID: resource_chapterNum_No (No 补齐3位)
    // 假设 No 是 "1", "2" 等
    const noStr = String(q.No).padStart(3, '0');
    // _id 必须是字符串
    const _id = `${q.resource}_${chapterNum}_${noStr}`;
    
    return {
      _id,
      ...q,
      subject: mapInfo.subject,
      textbook: mapInfo.textbook,
      chapterNum // 保留数字格式方便排序
    };
  });
  
  // 写入 JS 文件
  const outFilename = filename.replace('.txt', '.js');
  const outPath = path.join(srcDir, outFilename);
  const jsContent = `module.exports = ${JSON.stringify(processed, null, 2)};`;
  
  fs.writeFileSync(outPath, jsContent);
  console.log(`Success: ${filename} -> ${outFilename}, count: ${processed.length}`);
}

// 主流程
try {
  const files = fs.readdirSync(srcDir);
  files.forEach(processFile);
} catch (err) {
  console.error('Error reading directory:', err);
}
