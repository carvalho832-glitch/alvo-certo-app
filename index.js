const express = require('express');
const path = require('path');
const crypto = require('crypto');
const https = require('https'); 
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
        console.log("✅ Conectado ao MongoDB Atlas com Rastreador de Tempo!");
    } catch (error) {
        console.error("⚠️ Usando banco reserva local:", error.message);
    }
}
conectarBanco();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Motor estável do TinyURL
function encurtarLinkLink(urlLonga) {
    return new Promise((resolve) => {
        const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlLonga)}`;
        const options = {
            headers: { 'User-Agent': 'AlvoCertoApp/1.0' },
            timeout: 6000
        };
        https.get(apiUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 && data.trim() && !data.toLowerCase().includes('error')) {
                    resolve(data.trim());
                } else {
                    resolve(urlLonga);
                }
            });
        }).on('error', () => { resolve(urlLonga); });
    });
}

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
        const linkRenderRastreio = `https://alvo-certo-app.onrender.com/clique/${idCurto}`;

        const linkCurtoFinal = await encurtarLinkLink(linkRenderRastreio);

        const novoLink = {
            idCurto,
            urlOriginal,
            linkCurto: linkCurtoFinal, 
            descricao,
            precoAlvo,
            nomeGrupo, 
            cliques: 0,
            historicoCliques: [], // ⌚ AQUI COMEÇA O RASTREAMENTO DE TEMPO ZERADO
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

// ROTA 2: Redirecionar clique e ANOTAR A HORA EXATA ⌚
app.get('/clique/:idCurto', async (req, res) => {
    try {
        const { idCurto } = req.params;
        const dataDoClique = new Date(); // Captura o segundo exato que o cliente clicou

        if (linksCollection) {
            try {
                const link = await linksCollection.findOne({ idCurto });
                if (link) {
                    await linksCollection.updateOne(
                        { idCurto }, 
                        { 
                            $inc: { cliques: 1 },
                            $push: { historicoCliques: dataDoClique } // Salva o relógio no cofre
                        } 
                    );
                    return res.redirect(link.urlOriginal);
                }
            } catch (err) { console.error(err.message); }
        }
        
        // Caso o banco falhe, anota na memória reserva
        const linkReserva = bancoReserva[idCurto];
        if (linkReserva) {
            linkReserva.cliques += 1;
            if (!linkReserva.historicoCliques) linkReserva.historicoCliques = [];
            linkReserva.historicoCliques.push(dataDoClique);
            return res.redirect(linkReserva.urlOriginal);
        }
        return res.status(404).send('<h1>Link não encontrado.</h1>');
    } catch (error) { res.status(500).send('Erro ao redirecionar.'); }
});

// ROTA 3: Histórico unificado 
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

// ROTA 5: Apagar tudo
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

// ROTA 6: Dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, () => { console.log(`🚀 Servidor ativo na porta ${PORT}!`); });
