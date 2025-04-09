const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const {format, isValid, parse} = require('date-fns')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'todoApplication.db')
let db = null

const initializeDB = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  })
}

initializeDB()

// Valid values
const validStatus = ['TO DO', 'IN PROGRESS', 'DONE']
const validPriority = ['HIGH', 'MEDIUM', 'LOW']
const validCategory = ['WORK', 'HOME', 'LEARNING']

// Utility for date validation
const formatDate = dateString => {
  const parsedDate = parse(dateString, 'yyyy-MM-dd', new Date())
  if (!isValid(parsedDate)) return null
  return format(parsedDate, 'yyyy-MM-dd')
}

// Validation helpers
const validateQuery = (req, res, next) => {
  const {status, priority, category, dueDate} = req.query

  if (status && !validStatus.includes(status)) {
    return res.status(400).send('Invalid Todo Status')
  }
  if (priority && !validPriority.includes(priority)) {
    return res.status(400).send('Invalid Todo Priority')
  }
  if (category && !validCategory.includes(category)) {
    return res.status(400).send('Invalid Todo Category')
  }
  if (dueDate && !formatDate(dueDate)) {
    return res.status(400).send('Invalid Due Date')
  }

  next()
}

const validateBody = (req, res, next) => {
  const {status, priority, category, dueDate} = req.body

  if (status && !validStatus.includes(status)) {
    return res.status(400).send('Invalid Todo Status')
  }
  if (priority && !validPriority.includes(priority)) {
    return res.status(400).send('Invalid Todo Priority')
  }
  if (category && !validCategory.includes(category)) {
    return res.status(400).send('Invalid Todo Category')
  }
  if (dueDate && !formatDate(dueDate)) {
    return res.status(400).send('Invalid Due Date')
  }

  next()
}

// API 1 - GET /todos/
app.get('/todos/', validateQuery, async (req, res) => {
  const {status, priority, search_q = '', category} = req.query
  let query = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%'`
  if (status) query += ` AND status = '${status}'`
  if (priority) query += ` AND priority = '${priority}'`
  if (category) query += ` AND category = '${category}'`

  const todos = await db.all(query)
  res.send(
    todos.map(todo => ({
      ...todo,
      dueDate: todo.due_date,
    })),
  )
})

// API 2 - GET /todos/:todoId/
app.get('/todos/:todoId/', async (req, res) => {
  const {todoId} = req.params
  const todo = await db.get('SELECT * FROM todo WHERE id = ?', [todoId])
  if (todo) {
    res.send({
      ...todo,
      dueDate: todo.due_date,
    })
  } else {
    res.status(404).send('Todo Not Found')
  }
})

// API 3 - GET /agenda/
app.get('/agenda/', async (req, res) => {
  const {date} = req.query
  const formattedDate = formatDate(date)
  if (!formattedDate) return res.status(400).send('Invalid Due Date')

  const todos = await db.all('SELECT * FROM todo WHERE due_date = ?', [
    formattedDate,
  ])
  res.send(
    todos.map(todo => ({
      ...todo,
      dueDate: todo.due_date,
    })),
  )
})

// API 4 - POST /todos/
app.post('/todos/', validateBody, async (req, res) => {
  const {id, todo, category, priority, status, dueDate} = req.body
  const formattedDate = formatDate(dueDate)

  await db.run(
    `INSERT INTO todo (id, todo, category, priority, status, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, todo, category, priority, status, formattedDate],
  )

  res.send('Todo Successfully Added')
})

// API 5 - PUT /todos/:todoId/
app.put('/todos/:todoId/', validateBody, async (req, res) => {
  const {todoId} = req.params
  const fields = ['status', 'priority', 'todo', 'category', 'dueDate']
  const updates = {}

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] =
        field === 'dueDate' ? formatDate(req.body[field]) : req.body[field]
    }
  })

  const updateKeys = Object.keys(updates)
  if (updateKeys.length === 0) return res.status(400).send('No Updates Found')

  const [field] = updateKeys
  const dbField = field === 'dueDate' ? 'due_date' : field

  await db.run(`UPDATE todo SET ${dbField} = ? WHERE id = ?`, [
    updates[field],
    todoId,
  ])

  res.send(`${field[0].toUpperCase() + field.slice(1)} Updated`)
})

// API 6 - DELETE /todos/:todoId/
app.delete('/todos/:todoId/', async (req, res) => {
  const {todoId} = req.params
  await db.run('DELETE FROM todo WHERE id = ?', [todoId])
  res.send('Todo Deleted')
})

// Export express app
module.exports = app
