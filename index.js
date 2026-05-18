const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 10000;

// String de conexão conectada e validada
const mongoUri = "mongodb+srv://carvalhojulio773_db_user:julio123456@cluster0.3b2msar.mongodb.net/?appName=Cluster0";

let db, linksCollection;
let bancoReserva = {};

async function conectarBanco() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('alvo_certo_dados');
        linksCollection = db.collection('links');
        console.log("✅ Conectado ao MongoDB! (Motor Turbo + Escudo Anti-Robô 🛡️)");
    } catch (error) {
        console.error("⚠️ Usando banco reserva local:", error.message);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ROTA 1: Salva o link 
app.post('/api/encurtar', async (req, res) => {
    try {
        let urlOriginal = req.body.urlOriginal || req.body.url || req.body.link;
        
        if (!urlOriginal) {
            return res.status(400).json({ error: 'Por favor, insira um link válido.' });
        }

        urlOriginal = urlOriginal.trim();
        const descricao = req.body.descricao || 'Produto sem nome';
        const precoAlvo = req.body.precoAlvo || 'N/A';
        const nomeGrupo = req.body.nomeGrupo || req.body.grupo || 'Geral';

        const idCurto = crypto.randomBytes(3).toString('hex'); 
        const linkCurtoFinal = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        const novoLink = {
            idCurto,
            urlOriginal,
            linkCurto: linkCurtoFinal, 
            descricao,
            precoAlvo,
            nomeGrupo, 
            cliques: 0,
            historicoCliques: [], 
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

// ROTA 2: Redirecionar clique e Rastrear Horário (COM ESCUDO ANTI-ROBÔ 🛡️)
app.get('/clique/:idCurto', async (req, res) => {
    try {
        const { idCurto } = req.params;
        const dataDoClique = new Date(); 
        
        // 🕵️ DETETIVE: Lê a identidade de quem clicou
        const userAgent = req.headers['user-agent'] || '';
        
        // Lista negra de robôs: WhatsApp, ChatGPT, Facebook, Telegram, Google, etc.
        const isBot = /bot|chatgpt|facebookexternalhit|whatsapp|telegram|crawler|spider|slurp|yandex|google/i.test(userAgent);

        if (linksCollection) {
            try {
                const link = await linksCollection.findOne({ idCurto });
                if (link) {
                    // SÓ CONTA O CLIQUE SE NÃO FOR UM ROBÔ
                    if (!isBot) {
                        await linksCollection.updateOne(
                            { idCurto }, 
                            { 
                                $inc: { cliques: 1 },
                                $push: { historicoCliques: dataDoClique } 
                            } 
                        );
                    }
                    return res.redirect(link.urlOriginal);
                }
            } catch (err) { console.error(err.message); }
        }
        
        const linkReserva = bancoReserva[idCurto];
        if (linkReserva) {
            if (!isBot) {
                linkReserva.cliques += 1;
                if (!linkReserva.historicoCliques) linkReserva.historicoCliques = [];
                linkReserva.historicoCliques.push(dataDoClique);
            }
            return res.redirect(linkReserva.urlOriginal);
        }
        return res.status(404).send('<h1>Link não encontrado.</h1>');
    } catch (error) { res.status(500).send('Erro ao redirecionar.'); }
});

// ROTA 3: Dashboard
app.get('/api/links', async (req, res) => {
    try {
        let listaFinal = [];
        if (linksCollection) {
            try {
                listaFinal = await linksCollection.find().sort({ criadoEm: -1 }).toArray();
            } catch (err) { listaFinal = Object.values(bancoReserva); }
        } else { listaFinal = Object.values(bancoReserva); }
        res.json(listaFinal);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar links' }); }
});

// ROTA 4: Excluir link
app.delete('/api/links/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (linksCollection) {
            await linksCollection.deleteOne({ _id: new ObjectId(id) });
        } else {
            delete bancoReserva[id];
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar o link' });
    }
});

// ROTA 5: Limpar tudo
app.delete('/api/links-limpar-tudo', async (req, res) => {
    try {
        if (linksCollection) {
            await linksCollection.deleteMany({});
        }
        bancoReserva = {};
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao limpar o histórico' });
    }
});

// ROTA 6: Dashboard Page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => { console.log(`🚀 Servidor ativo na porta ${PORT}!`); });
