const express = require('express');
const path = require('path');
const crypto = require('crypto');
const http = require('https'); // Usado para chamar o encurtador gratuito
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// ⚠️ SUA CHAVE DO BANCO DE DADOS AQUI (Mantenha o link completo)
const mongoUri = "mongodb+srv://carvalhojulio773_db_user:7tIHmw2mEShgLtsI@cluster0.3b2msar.mongodb.net/?appName=Cluster0";

let db, linksCollection;

// Função para conectar ao MongoDB Atlas
async function conectarBanco() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('alvo_certo_dados');
        linksCollection = db.collection('links');
        console.log("✅ Conectado com sucesso ao MongoDB Atlas! Dados protegidos.");
    } catch (error) {
        console.error("❌ Erro ao conectar no MongoDB:", error);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para chamar o encurtador gratuito is.gd
function encurtarLinkLink(urlLonga) {
    return new Promise((resolve) => {
        http.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlLonga)}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim()) {
                    resolve(data.trim());
                } else {
                    resolve(urlLonga); // Se falhar, usa o link do Render temporariamente
                }
            });
        }).on('error', () => resolve(urlLonga));
    });
}

// ROTA 1: Criar o link rastreado e encurtado
app.post('/api/encurtar', async (req, { json }) => {
    try {
        const { urlOriginal, categoria, precoAlvo } = req.body;

        if (!urlOriginal) {
            return json({ error: 'URL original é obrigatória' });
        }

        const idCurto = crypto.randomBytes(3).toString('hex'); // Gera um código de 6 caracteres
        
        // Link intermediário do Render que faz o rastreamento
        const linkRenderRastreio = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        // Transforma o link comprido do Render em um link minúsculo tipo bit.ly (is.gd)
        console.log("Encurtando link de rastreio...");
        const linkCurtoFinal = await encurtarLinkLink(linkRenderRastreio);

        const novoLink = {
            idCurto,
            urlOriginal,
            categoria: categoria || 'Geral',
            precoAlvo: precoAlvo || 'N/A',
            cliques: 0,
            criadoEm: new Date()
        };

        await linksCollection.insertOne(novoLink);

        json({ linkCurto: linkCurtoFinal, idCurto });
    } catch (error) {
        console.error(error);
        json({ error: 'Erro interno no servidor' });
    }
});

// ROTA 2: Redirecionar e contar o clique (Salva direto no MongoDB)
app.get('/clique/:idCurto', async (req, res) => {
    try {
        const { idCurto } = req.params;
        
        const link = await linksCollection.findOne({ idCurto });

        if (link) {
            // Soma +1 clique direto no banco de dados definitivo
            await linksCollection.updateOne({ idCurto }, { $inc: { cliques: 1 } });
            return res.redirect(link.urlOriginal);
        } else {
            return res.status(404).send('<h1>Link não encontrado ou expirado.</h1>');
        }
    } catch (error) {
        res.status(500).send('Erro ao processar redirecionamento.');
    }
});

// ROTA 3: Listar o histórico de links direto do Banco de Dados
app.get('/api/links', async (req, { json }) => {
    try {
        if (!linksCollection) return json([]);
        const links = await linksCollection.find().sort({ criadoEm: -1 }).toArray();
        json(links);
    } catch (error) {
        json({ error: 'Erro ao buscar links' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sistema rodando com sucesso na porta ${PORT}!`);
});
