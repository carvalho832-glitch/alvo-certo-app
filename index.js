const express = require('express');
const path = require('path');
const crypto = require('crypto');
const http = require('https'); 
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// Chave de conexão direta com o MongoDB Atlas
const mongoUri = "mongodb+srv://carvalhojulio773_db_user:7tIHmw2mEShgLtsI@cluster0.3b2msar.mongodb.net/?appName=Cluster0";

let db, linksCollection;

async function conectarBanco() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('alvo_certo_dados');
        linksCollection = db.collection('links');
        console.log("✅ Conectado ao MongoDB Atlas!");
    } catch (error) {
        console.error("❌ Erro no MongoDB:", error);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Função para gerar o link curto usando a API do is.gd
function encurtarLinkLink(urlLonga) {
    return new Promise((resolve) => {
        http.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlLonga)}`, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim()) {
                    resolve(data.trim());
                } else {
                    resolve(urlLonga);
                }
            });
        }).on('error', () => resolve(urlLonga));
    });
}

// ROTA 1: Criar e encurtar o link (Corrigida para o formato padrão do Express)
app.post('/api/encurtar', async (req, res) => {
    try {
        const { urlOriginal, categoria, precoAlvo } = req.body;

        if (!urlOriginal) {
            return res.status(400).json({ error: 'URL original é obrigatória' });
        }

        const idCurto = crypto.randomBytes(3).toString('hex'); 
        const linkRenderRastreio = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        console.log("Encurtando link no is.gd...");
        const linkCurtoFinal = await encurtarLinkLink(linkRenderRastreio);

        const novoLink = {
            idCurto,
            urlOriginal,
            categoria: categoria || 'Geral',
            precoAlvo: precoAlvo || 'N/A',
            cliques: 0,
            criadoEm: new Date()
        };

        if (linksCollection) {
            await linksCollection.insertOne(novoLink);
        }

        res.json({ linkCurto: linkCurtoFinal, idCurto });
    } catch (error) {
        console.error("Erro na rota /api/encurtar:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// ROTA 2: Redirecionar e computar clique
app.get('/clique/:idCurto', async (req, res) => {
    try {
        const { idCurto } = req.params;
        
        if (!linksCollection) {
            return res.redirect('/');
        }

        const link = await linksCollection.findOne({ idCurto });

        if (link) {
            await linksCollection.updateOne({ idCurto }, { $inc: { cliques: 1 } });
            return res.redirect(link.urlOriginal);
        } else {
            return res.status(404).send('<h1>Link não encontrado.</h1>');
        }
    } catch (error) {
        res.status(500).send('Erro ao redirecionar.');
    }
});

// ROTA 3: Buscar histórico
app.get('/api/links', async (req, res) => {
    try {
        if (!linksCollection) return res.json([]);
        const links = await linksCollection.find().sort({ criadoEm: -1 }).toArray();
        res.json(links);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar links' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}!`);
});
