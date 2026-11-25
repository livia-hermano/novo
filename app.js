require('dotenv').config()

const fs = require('fs')
const path = require('path')
const express = require('express')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const mustache = require('mustache')

const app = express()

app.use(express.urlencoded({ extended: false }))
app.use(cookieParser()) // Corrigido: adicionados parênteses

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
})

app.use((req, res, next) => {
    const metodo = String(req.body?._method || '').toUpperCase()

    if (req.method === 'POST' && ['PUT', 'DELETE'].includes(metodo)) {
        req.method = metodo
    }
    next()
})

function mostrar(nome, dados = {}) {
    const arquivo = path.join(__dirname, 'paginas', `${nome}.html`)
    return mustache.render(fs.readFileSync(arquivo, 'utf-8'), dados)
}

function criptografar(texto) {
    if (!texto) return ''
    const cifra = crypto.createCipheriv('aes-256-cbc', process.env.CRIPTO_CHAVE, process.env.CRIPTO_IV)
    return cifra.update(texto, 'utf-8', 'hex') + cifra.final('hex')
}

function descriptografar(texto) {
    if (!texto) return ''
    try {
        const decifra = crypto.createDecipheriv('aes-256-cbc', process.env.CRIPTO_CHAVE, process.env.CRIPTO_IV)
        return decifra.update(texto, 'hex', 'utf-8') + decifra.final('utf-8')
    } catch {
        return texto
    }
}

// Corrigido: sintaxe do db.query e bloco try/catch
async function excluir(res, tabela, id, volta, motivo) {
    try {
        await db.query(`DELETE FROM ${tabela} WHERE id = ?`, [id])
        return res.redirect(volta)
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).send(`<p>Não foi possível excluir: ${motivo}.</p><p><a href="${volta}">Voltar</a></p>`)
        }
        console.error(error)
        return res.status(500).send(`<p>Erro ao excluir.</p><p><a href="${volta}">Voltar</a></p>`)
    }
}

app.get('/', (req, res) => {
    res.send(mostrar('login'))
})

app.post('/login', async (req, res) => {
    const { email, senha } = req.body

    // Corrigido: desestruturação de array [usuarios] em vez de objeto {usuarios}
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email])

    const usuario = usuarios[0]

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
        return res.send(mostrar('login', { erro: 'E-mail ou senha inválidos.' }))
    }

    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '1h' })

    res.cookie('token', token, { httpOnly: true })
    res.redirect('/principal')
})

app.post('/sair', (req, res) => {
    res.clearCookie('token')
    res.redirect('/')
})

// Middleware de autenticação
app.use((req, res, next) => {
    try {
        req.usuario = jwt.verify(req.cookies.token, process.env.JWT_SECRET)
        next()
    } catch {
        res.redirect('/')
    }
})

app.get('/principal', (req, res) => {
    res.send(mostrar('principal', { nome: req.usuario.nome }))
})

app.get('/clientes', async (req, res) => {
    const busca = req.query.busca || ''

    const [lista] = await db.query('SELECT * FROM clientes WHERE nome LIKE ?', [`%${busca}%`])

    const clientes = lista.map((cliente) => ({
        ...cliente,
        cpf: descriptografar(cliente.cpf)
    }))

    // Corrigido: retorno implícito na arrow function
    const editar = clientes.find((cliente) => String(cliente.id) === req.query.editar)

    res.send(mostrar('clientes', {
        busca,
        clientes,
        editando: Boolean(editar),
        acao: editar ? `/clientes/${editar.id}` : `/clientes`,
        form: editar || {}
    }))
})

app.post('/clientes', async (req, res) => {
    const { nome, cpf, telefone, email } = req.body

    await db.query(
        'INSERT INTO clientes (nome, cpf, telefone, email) VALUES (?, ?, ?, ?)',
        [nome, criptografar(cpf), telefone, email]
    )

    res.redirect('/clientes')
})

// Adicionado: rota PUT para salvar a edição do cliente
app.put('/clientes/:id', async (req, res) => {
    const { nome, cpf, telefone, email } = req.body

    await db.query(
        'UPDATE clientes SET nome = ?, cpf = ?, telefone = ?, email = ? WHERE id = ?',
        [nome, criptografar(cpf), telefone, email, req.params.id]
    )

    res.redirect('/clientes')
})

app.delete('/clientes/:id', async (req, res) => {
    await excluir(res, 'clientes', req.params.id, '/clientes', 'o cliente possui veículos cadastrados')
})

async function mostrarVeiculos(req, res, erro = ''){
    const [veiculos] = await db.query('SELECT * FROM veiculos')

    const [listaClientes] = await db.query('SELECT id, nome FROM clientes')

    const editar = veiculos.find(v => String(v.id) === req.query.editar)

    const clientes = listaClientes.map((cliente) => ({...cliente,
        selecionado: editar && cliente.id === editar.cliente_id
    }))

    res.send(mostrar('veiculos', {
        veiculos, 
        clientes, 
        erro, 
        editando: Boolean(editar),
         acao: editar ? `/veiculos/${editar.id}` : '/veiculos', 
         form: editar || {} 
    }))
}

app.get('/veiculos', (req, res) => mostrarVeiculos(req,res))

app.post('/veiculos', async (req,res) =>{
    const {cliente_id, placa, marca, modelo, ano} = req.body

    if(!cliente_id){
        return mostrarVeiculos(req,res, ' cliente_id é obrigatório')
    }
    await db.query('INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano) VALUES (?,?,?,?,?)', [cliente_id,placa,marca,modelo,ano||null])

    res.redirect('/veiculos')
})

app.put('/veiculos/:id', async (req,res) => {
    const {cliente_id, placa, marca, modelo, ano} = req.body

    if(!cliente_id){
        return mostrarVeiculos(req,res, 'cliente_id é obrigatório')
    }

    await db.query('UPDATE veiculos SET cliente_id = ?, placa = ?, marca = ?, modelo = ?, ano= ? WHERE id =?', [cliente_id,placa,marca,modelo,ano||null, req.params.id])

    res.redirect('/veiculos')
})

app.delete('/veiculos/:id', async (req,res) => {
    await excluir(res, 'veiculos', req.params.id, '/veiculos', 'o veículo possui agendamento')
})

app.get('/agendamentos', async (req,res) =>{
    const [lista] = await db.query(`SELECT agendamentos.*, veiculos.placa, veiculos.marca, veiculos.modelo, clientes.nome AS cliente_nome FROM agendamentos JOIN veiculos ON veiculos.id = agendamentos.veiculo_id JOIN clientes ON clientes.id = veiculos.clientes_id ORDER BY agendamentos.data_agendamento`)

    const [veiculos] = await db.query('SELECT * FROM veiculos')

    const agendamentos = lista.map((a) => ({
        ...a,
        data_br: new Date(a.data_agendamento).toLocaleDateString('pt-BR'),
        data_input: a.data_agendamento.slice(0, 16).replace('','T')
    }))

    res.send(mostrar('agendamento', {agendamentos,veiculos}))
})

app.post('/agendamentos', async (req,res) => {
    const {veiculo_id, data_agendamento, servico} = req.body

    await db.query('INSERT INTO agendamentos (veiculo_id, data_agendamento, servico) VALUES (?,?,?)', [veiculo_id, data_agendamento.replace('T', ' '),servico])

    res.redirect('/agendamentos')
})

app.put('/agendamento/:id', async (req, res) =>{
    await db.query('UPDATE agendamentos SET data_agendamento = ? WHERE id = ?', [req.body.data_agendamento.replace('T', ' '), req.params.id])

    res.redirect('/agendamento')
})

app.delete('/agendamentos/:id', async (req, res) => {
    await excluir(res, 'agendametos', req.params.id, '/agendamentos', '')
})

const port = process.env.PORT || 3000

app.listen(port, () => {
    console.log(`Oficina TORQUE rodando em http://localhost:${port}`)
})


