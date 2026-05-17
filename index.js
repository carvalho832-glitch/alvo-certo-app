const express = require('express');
const path = require('path');
const crypto = require('crypto');
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
        console.log("✅ Conectado ao MongoDB Atlas com sucesso!");
    } catch (error) {
        console.error("❌ Erro de conexão no MongoDB:", error);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔄 NOVA FUNÇÃO DE ENCURTAMENTO: Revisada, usando HTTPS Nativo (Fetch) e User-Agent
async function encurtarLinkLink(urlLonga) {
    try {
        const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlLonga)}`;
        
        const resposta = await fetch(apiUrl, {
            headers: { 'User-Agent': 'AlvoCertoApp/1.0' }
        });

        if (resposta.ok) {
            const texto = await resposta.text();
            if (texto && texto.trim()) {
                return texto.trim();
            }
        }
        return urlLonga; // Se a API falhar, retorna o link do Render como plano de fundo
    } catch (error) {
        console.error("⚠️ Erro ao chamar API do is.gd, usando link padrão:", error);
        return urlLonga;
    }
}

// ROTA 1: Criar e encurtar o link
app.post('/api/encurtar', async (req, res) => {
    try {
        const { urlOriginal, categoria, precoAlvo } = req.body;

        if (!urlOriginal) {
            return res.status(400).json({ error: 'URL original é obrigatória' });
        }

        const idCurto = crypto.randomBytes(3).toString('hex'); // Código de 6 letras/números
        const linkRenderRastreio = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        // Chama o encurtador corrigido
        const linkCurtoFinal = await encurtarLinkLink(linkRenderRastreio);

        const novoLink = {
            idCurto,
            urlOriginal,
            categoria: categoria || 'Geral',
            precoAlvo: precoAlvo || 'N/A',
            cliques: 0,
            criadoEm: new Date()
        };

        // Salva no banco de dados se ele estiver conectado
        if (linksCollection) {
            await linksCollection.insertOne(novoLink);
        } else {
            console.error("❌ Banco de dados não inicializado no momento do insert.");
            return res.status(500).json({ error: 'Banco de dados inacessível' });
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
        console.error("Erro no redirecionamento:", error);
        res.status(500).send('Erro ao redirecionar.');
    }
});

// ROTA 3: Buscar histórico para a tabela
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
    console.log(`🚀 Servidor ativo e revisado na porta ${PORT}!`);
});
