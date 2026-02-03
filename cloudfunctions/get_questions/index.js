// cloudfunctions/get_questions/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const MAX_LIMIT = 100

exports.main = async (event, context) => {
  const { 
    action = 'getQuestions', 
    subject, 
    textbook, 
    chapter, 
    ids, 
    page = 1, 
    pageSize = 20,
    usePagination = false
  } = event

  try {
    // 1. 获取教材列表
    if (action === 'getTextbooks') {
      if (!subject) return { code: -1, msg: 'subject required' }
      const res = await db.collection('questions')
        .aggregate()
        .match({ subject })
        .group({ _id: '$textbook' })
        .end()
      
      const list = res.list.map(i => i._id).filter(Boolean)
      // 简单排序
      list.sort()
      return { code: 0, data: list }
    }

    // 2. 获取章节列表
    if (action === 'getChapters') {
      // 必须指定教材，因为不同教材章节可能不同
      if (!textbook) return { code: -1, msg: 'textbook required' }
      
      const matchQuery = { textbook }
      if (subject) matchQuery.subject = subject

      const res = await db.collection('questions')
        .aggregate()
        .match(matchQuery)
        .group({ 
          _id: '$chapter',
          count: db.command.aggregate.sum(1)
        })
        .end()
      
      const list = res.list.map(i => ({
        name: i._id,
        count: i.count
      })).filter(i => i.name)
      
      // 章节排序逻辑：提取中文数字进行排序
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

      list.sort((a, b) => {
        const getNum = (str) => {
           const match = str.match(/第(.+)章/)
           return match ? chnToNum(match[1]) : 0
        }
        return getNum(a.name) - getNum(b.name)
      })

      return { code: 0, data: list }
    }

    // 3. 获取题目（原有逻辑 + 筛选 + 分页）
    let query = db.collection('questions')
    
    // Mode 1: Query by IDs (for review/favorites)
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const queryIds = ids.slice(0, 100)
      query = query.where({
        _id: db.command.in(queryIds)
      })
    } 
    // Mode 2: Query by Filters
    else {
      const filter = {}
      if (subject) filter.subject = subject
      if (textbook) filter.textbook = textbook
      if (chapter) filter.chapter = chapter
      
      if (Object.keys(filter).length === 0) {
         return { code: -1, msg: 'Please provide subject or ids' }
      }
      query = query.where(filter)
    }

    query = query.orderBy('_id', 'asc')

    // Count total
    const countResult = await query.count()
    const total = countResult.total
    
    // 分页模式
    if (usePagination) {
      const res = await query.skip((page - 1) * pageSize).limit(pageSize).get()
      return {
        code: 0,
        data: res.data,
        total
      }
    }

    // 全量获取模式 (Batch fetch)
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = query.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
      tasks.push(promise)
    }
    
    if (batchTimes === 0) {
        return { code: 0, data: [], total: 0 }
    }
    
    const result = await Promise.all(tasks)
    const data = result.reduce((acc, cur) => acc.concat(cur.data), [])
    
    return {
      code: 0,
      data: data,
      total
    }

  } catch (err) {
    console.error(err)
    return {
      code: -1,
      msg: err.errMsg,
      err
    }
  }
}
