const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/questions');
const OUTPUT_FILE = path.join(DATA_DIR, 'all_questions.js');

const chnToNum = (chnStr) => {
  const chnNumChar = { '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 }
  const chnNameValue = { 
    '十': { value: 10, secUnit: false },
    '百': { value: 100, secUnit: false },
    '千': { value: 1000, secUnit: false },
    '万': { value: 10000, secUnit: true },
    '亿': { value: 100000000, secUnit: true }
  }
  let rtn = 0, section = 0, number = 0, secUnit = false
  const str = chnStr.split('')
  for(let i = 0; i < str.length; i++){
    let num = chnNumChar[str[i]]
    if(typeof num !== 'undefined'){
      number = num
    } else {
      let unitNode = chnNameValue[str[i]]
      if(typeof unitNode !== 'undefined'){
        let unit = unitNode.value
        secUnit = unitNode.secUnit
        if(secUnit){
          section = (section + number) * unit
          rtn += section
          section = 0
        } else {
          if (number === 0 && unit === 10) number = 1
          section += (number * unit)
        }
        number = 0
      }
    }
  }
  return rtn + section + number
}

function getChapterNum(chapterStr) {
  if (!chapterStr) return 0;
  const match = chapterStr.match(/第([一二三四五六七八九十百]+)章/);
  if (match) {
    return chnToNum(match[1]);
  }
  return 0;
}

function processFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Directory not found: ${DATA_DIR}`);
    return;
  }

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt'));
  let allQuestions = [];
  let totalProcessed = 0;

  console.log(`Found ${files.length} .txt files in ${DATA_DIR}`);

  files.forEach(file => {
    const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
    let questions = [];

    // Try extracting JSON block from markdown
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    
    try {
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[1]);
      } else {
        // Try raw JSON
        questions = JSON.parse(content);
      }

      if (Array.isArray(questions)) {
        const processed = questions.map(q => {
          const chapterNum = getChapterNum(q.chapter);
          // Handle No as number or string
          const qNo = String(q.No).padStart(3, '0');
          
          // Manual object construction to avoid spread operator if that was an issue in miniprogram environment (though this is node script)
          // But to be safe and clean:
          return Object.assign({}, q, {
            _id: `${q.resource}_${chapterNum}_${qNo}`,
            subject: '药理学', 
            textbook: '药理学习题指导',
            chapterNum: chapterNum,
            // Standardize field names to match exerciseDetail.js expectation
            // Note: exerciseDetail.js expects 'options' or 'choice', we can keep 'choose' as is if we map it later,
            // BUT user asked to fix inconsistency.
            // Let's look at exerciseDetail.js: processCloudQuestions uses `item.options || item.choice`.
            // The raw data uses `choose`. Let's rename `choose` to `options` for consistency.
            options: q.choose, 
            explanation: q.explanation // ensure this exists
          });
        });

        allQuestions = allQuestions.concat(processed);
        totalProcessed += processed.length;
        console.log(`[SUCCESS] ${file}: ${processed.length} questions`);
      }
    } catch (e) {
      console.error(`[ERROR] Failed to parse ${file}: ${e.message}`);
    }
  });

  const fileContent = `module.exports = ${JSON.stringify(allQuestions, null, 2)}`;
  fs.writeFileSync(OUTPUT_FILE, fileContent);
  console.log('------------------------------------------------');
  console.log(`Successfully generated ${OUTPUT_FILE}`);
  console.log(`Total questions: ${totalProcessed}`);
  console.log('Now you can click "Import" in the Mini Program.');
}

processFiles();
