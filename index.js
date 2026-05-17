const express = require('express');
const path = require('path');
const crypto = require('crypto');
const https = require('https'); 
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// String de conexão direta com o MongoDB Atlas
const mongoUri = "mongodb+srv://carvalhojulio773_db_user:julio123456@cluster0.3b2msar.mongodb.net/?appName=Cluster0";

let db, linksCollection;
let bancoReserva = {};

async function conectarBanco() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('alvo_certo_dados');
        linksCollection = db.collection('links');
        console.log("✅ Conectado ao MongoDB Atlas!");
    } catch (error) {
        console.error("⚠️ Usando banco reserva local:", error.message);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🛠️ FUNÇÃO ENCURTADORA CLÁSSICA (Compatível com qualquer versão do Node no Render)
function encurtarLinkLink(urlLonga) {
    return new Promise((resolve) => {
        const apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(urlLonga)}`;
        
        const options = {
            headers: { 'User-Agent': 'AlvoCertoApp/1.0' },
            timeout: 5000
        };

        https.get(apiUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim()) {
                    resolve(data.trim());
                } else {
                    resolve(urlLonga);
                }
            });
        }).on('error', () => {
            resolve(urlLonga);
        });
    });
}

// ROTA 1: Criar e encurtar o link
app.post('/api/encurtar', async (req, res) => {
    try {
        const { urlOriginal, categoria, precoAlvo } = req.body;

        if (!urlOriginal) {
            return res.status(400).json({ error: 'URL original é obrigatória' });
        }

        const idCurto = crypto.randomBytes(3).toString('hex'); 
        const linkRenderRastreio = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        // Executa o encurtador clássico seguro
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
            try {
                await linksCollection.insertOne(novoLink);
            } catch (err) {
                bancoReserva[idCurto] = novoLink;
            }
        } else {
            bancoReserva[idCurto] = novoLink;
        }

        res.json({ linkCurto: linkCurtoFinal, idCurto });
    } catch (error) {
        console.error("Erro na rota de encurtamento:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

// ROTA 2: Redirecionar clique
app.get('/clique/:idCurto', async (req, res) => {
    try {
        const { idCurto } = req.params;
        
        if (linksCollection) {
            try {
                const link = await linksCollection.findOne({ idCurto });
                if (link) {
                    await linksCollection.updateOne({ idCurto }, { $inc: { cliques: 1 } });
                    return res.redirect(link.urlOriginal);
                }
            } catch (err) {
                console.error("Erro Mongo:", err.message);
            }
        }

        const linkReserva = bancoReserva[idCurto];
        if (linkReserva) {
            linkReserva.cliques += 1;
            return res.redirect(linkReserva.urlOriginal);
        }

        return res.status(404).send('<h1>Link não encontrado.</h1>');
    } catch (error) {
        res.status(500).send('Erro ao redirecionar.');
    }
});

// ROTA 3: Histórico unificado
app.get('/api/links', async (req, res) => {
    try {
        let listaFinal = [];
        if (linksCollection) {
            try {
                listaFinal = await linksCollection.find().sort({ criadoEm: -1 }).toArray();
            } catch (err) {
                listaFinal = Object.values(bancoReserva);
            }
        } else {
            listaFinal = Object.values(bancoReserva);
        }
        res.json(listaFinal);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar links' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}!`);
});

