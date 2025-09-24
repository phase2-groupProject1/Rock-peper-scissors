const express = require('express')
const app = express()
const port = 3000

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const UserController = require('./controllers/userController');

app.get('/', (req, res) => {
  res.send('Hello World!')
})


// Endpoint Users
app.post('/users', UserController.register);
app.get('/users/:id', UserController.getById);

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})