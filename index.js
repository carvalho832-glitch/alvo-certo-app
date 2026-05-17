const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve a nossa interface visual da pasta 'public'
app.use(express.static('public')); 

// Banco de dados em memória (vamos trocar por um real depois)
const bancoDeLinks = {};

// Rota para receber os dados da tela e gerar o link rastreado
app.post('/gerar', (req, res) => {
    const { url_afiliado, categoria, preco } = req.body;
    
    const idUnico = Math.random().toString(36).substring(2, 8);
    
    bancoDeLinks[idUnico] = {
        url_afiliado: url_afiliado,
        categoria: categoria,
        preco: preco,
        cliques: 0
    };
    
    console.log(`Nova oferta cadastrada! ID: ${idUnico}`);
    res.json({ link_rastreio: `/clique/${idUnico}` });
});

// Rota Mágica: Conta o clique e redireciona para a loja
app.get('/clique/:id', (req, res) => {
    const idDaOferta = req.params.id;
    const produto = bancoDeLinks[idDaOferta];

    if (produto) {
        produto.cliques += 1;
        console.log(`[CLIQUE] Oferta ${idDaOferta} bateu ${produto.cliques} cliques.`);
        res.redirect(produto.url_afiliado);
    } else {
        res.status(404).send('Poxa, essa oferta não foi encontrada ou já expirou.');
    }
});

// Rota para alimentar os gráficos do painel
app.get('/painel-dados', (req, res) => {
    res.json(bancoDeLinks);
});

app.listen(PORT, () => {
    console.log(`🚀 Sistema rodando com sucesso!`);
    console.log(`👉 Acesse http://localhost:${PORT} no seu navegador para abrir o painel.`);
});
