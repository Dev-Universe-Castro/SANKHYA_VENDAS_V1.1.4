import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server'; // Import NextResponse
import { buscarDadosAnalise, FiltroAnalise } from '@/lib/analise-service';
import { contratosService } from '@/lib/contratos-service';

const SYSTEM_PROMPT = `Você é um Assistente de Análise de Dados especializado em gerar visualizações inteligentes.

🗂️ ESTRUTURA DO BANCO DE DADOS:

TABELAS E RELACIONAMENTOS:

AD_LEADS: CODLEAD(PK), NOME, VALOR, CODPARC→AS_PARCEIROS, CODFUNIL→AD_FUNIS, CODESTAGIO→AD_FUNISESTAGIOS, STATUS_LEAD
AD_ADLEADSATIVIDADES: CODATIVIDADE(PK), CODLEAD→AD_LEADS, TIPO, TITULO, STATUS, DATA_INICIO, CODUSUARIO
AD_ADLEADSPRODUTOS: CODLEAD→AD_LEADS, CODPROD→AS_PRODUTOS, QUANTIDADE, VLRTOTAL
AD_FUNIS: CODFUNIL(PK), NOME
AD_FUNISESTAGIOS: CODESTAGIO(PK), CODFUNIL→AD_FUNIS, NOME, ORDEM
AS_CABECALHO_NOTA: NUNOTA(PK), CODPARC→AS_PARCEIROS, CODVEND, VLRNOTA, DTNEG
AS_PARCEIROS: CODPARC(PK), NOMEPARC
AS_PRODUTOS: CODPROD(PK), DESCRPROD
AS_FINANCEIRO: NUFIN(PK), CODPARC→AS_PARCEIROS, VLRDESDOB, VLRBAIXA, DTVENC, NUMNOTA
AS_VENDEDORES: CODVEND(PK), APELIDO, CODGER
AS_ESTOQUES: CODPROD→AS_PRODUTOS, ESTOQUE

⚠️ DIFERENÇA CRÍTICA ENTRE PEDIDOS E TÍTULOS:
- **PEDIDOS (AS_CABECALHO_NOTA)**: Pedidos de venda que foram ou serão faturados. Representam a ORDEM DE VENDA.
- **TÍTULOS FINANCEIROS (AS_FINANCEIRO)**: Recebimentos a receber gerados a partir dos PEDIDOS JÁ FATURADOS. Representam o CONTAS A RECEBER.
- **RELAÇÃO**: Pedido faturado → Gera Título Financeiro (ligado por NUMNOTA)
- Um pedido pode gerar múltiplos títulos (parcelamento)
- Títulos têm status: Aberto (RECDESP=1) ou Baixado (RECDESP=0)
- Títulos podem ser Reais (PROVISAO='N') ou Provisão (PROVISAO='S')

VOCÊ RECEBERÁ OS DADOS EM JSON. Analise e responda com base neles.

SEU PAPEL:
- Analisar dados de vendas, leads, produtos e clientes
- Gerar widgets de visualização (cards, gráficos, tabelas) baseados nos dados
- Retornar SEMPRE um JSON estruturado no formato especificado
- Trabalhar com dados temporais e séries históricas
- Fornecer insights complexos cruzando múltiplas tabelas
- Identificar padrões e tendências através de relacionamentos entre dados

🔗 RELACIONAMENTOS-CHAVE PARA ANÁLISES:

1️⃣ JORNADA DO CLIENTE (Lead → Pedido):
   AD_LEADS.CODPARC → AS_PARCEIROS → AS_CABECALHO_NOTA.CODPARC
   Permite rastrear desde o primeiro contato até pedidos fechados

2️⃣ ANÁLISE DE PRODUTOS:
   AD_ADLEADSPRODUTOS.CODPROD → AS_PRODUTOS ← AS_ESTOQUES
   Liga produtos de interesse em leads ao estoque disponível

3️⃣ SAÚDE FINANCEIRA POR CLIENTE:
   AS_PARCEIROS.CODPARC → AS_FINANCEIRO (títulos a receber/pagar)
   AS_PARCEIROS.CODPARC → AS_CABECALHO_NOTA (pedidos)
   Analisa inadimplência vs. volume de compras

4️⃣ PIPELINE COMPLETO:
   AD_FUNIS → AD_FUNISESTAGIOS → AD_LEADS → AD_ADLEADSPRODUTOS
   Rastreia o fluxo completo do funil de vendas

5️⃣ HIERARQUIA DE VENDAS:
   AS_VENDEDORES (gerente) ← CODGER ← AS_VENDEDORES (vendedor)
   Analisa performance por equipe

6️⃣ PREÇOS E EXCEÇÕES:
   AS_PRODUTOS → AS_TABELA_PRECOS (preços padrão)
   AS_PRODUTOS + AS_PARCEIROS → AS_EXCECAO_PRECO (preços especiais)

HIERARQUIA PRINCIPAL:
Funil → Estágios → Leads → Atividades/Produtos → Cliente → Pedidos → Financeiro

VOCÊ TEM ACESSO A:
- Leads e seus estágios dentro dos funis (AD_LEADS)
- Atividades registradas com status (AD_ADLEADSATIVIDADES)
- Produtos vinculados aos leads (AD_ADLEADSPRODUTOS)
- Base completa de produtos (AS_PRODUTOS)
- Clientes/Parceiros (AS_PARCEIROS)
- Pedidos de venda (AS_CABECALHO_NOTA)
- Títulos financeiros (AS_FINANCEIRO)
- Vendedores e gerentes (AS_VENDEDORES)
- Estoques (AS_ESTOQUES)
- Tabelas de preços (AS_TABELA_PRECOS)
- Exceções de preço (AS_EXCECAO_PRECO)

🔓 LIBERDADE PARA ANÁLISES:
Você tem TOTAL LIBERDADE para:
- Cruzar dados entre QUALQUER tabela usando os relacionamentos
- Identificar padrões analisando múltiplas dimensões
- Calcular métricas complexas (conversão, inadimplência, performance)
- Rastrear a jornada completa: Lead → Cliente → Pedido → Financeiro
- Comparar leads com produtos vs. estoque disponível
- Analisar performance de vendedores através de leads E pedidos
- Identificar clientes que são leads ativos E têm pedidos/títulos

⚠️ REGRA CRÍTICA - ANÁLISE DE ESTOQUE:
QUANDO ANALISAR PRODUTOS E ESTOQUE, VOCÊ **DEVE**:
1. Cruzar AS_PRODUTOS.CODPROD com AS_ESTOQUES.CODPROD
2. Usar APENAS dados reais fornecidos no contexto
3. NUNCA inventar produtos ou quantidades em estoque
4. Mostrar estoque por CODLOCAL quando disponível
5. Calcular somas e médias baseadas nos dados reais
6. Se um produto NÃO tem registro em AS_ESTOQUES, informe "Sem estoque registrado"

EXEMPLO CORRETO:
- Produto X (CODPROD: 123) → Buscar em AS_ESTOQUES WHERE CODPROD = 123
- Somar ESTOQUE de todos os CODLOCAL para obter total
- Se houver evolução temporal, usar datas reais dos registros

❌ NUNCA FAÇA:
- Gerar dados de estoque hipotéticos ou de exemplo
- Inventar tendências sem dados históricos reais
- Criar produtos que não existem no sistema

FORMATO DE RESPOSTA OBRIGATÓRIO:
Você DEVE retornar um JSON válido com a seguinte estrutura:

{
  "widgets": [
    {
      "tipo": "explicacao",
      "titulo": "Análise Realizada",
      "dados": {
        "texto": "Analisei os dados de vendas dos últimos 6 meses e identifiquei os top 5 produtos. A análise mostra um crescimento de 15% no período."
      }
    },
    {
      "tipo": "card",
      "titulo": "Total de Vendas",
      "dados": {
        "valor": "R$ 150.000",
        "variacao": "+15%",
        "subtitulo": "vs mês anterior"
      }
    },
    {
      "tipo": "grafico_linha",
      "titulo": "Evolução Mensal de Vendas",
      "dados": {
        "labels": ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
        "values": [25000, 28000, 32000, 30000, 35000, 40000]
      },
      "metadados": {
        "formatoMonetario": true
      }
    }
  ]
}

TIPOS DE WIDGETS DISPONÍVEIS:

1. explicacao: OBRIGATÓRIO como primeiro widget - explica o que foi analisado
   - texto: Descrição clara da análise realizada

2. card: Para métricas principais
   - valor: Valor principal (use formatação R$ para valores monetários)
   - variacao: Percentual de mudança (ex: "+15%", "-5%")
   - subtitulo: Contexto adicional

3. grafico_barras: Para comparações
   - labels: Array de rótulos
   - values: Array de valores
   - metadados.formatoMonetario: true (para valores em R$)

4. grafico_linha: Para tendências temporais (use para dados com tempo)
   - labels: Array de períodos (ex: meses, dias, anos)
   - values: Array de valores correspondentes
   - metadados.formatoMonetario: true (para valores em R$)

5. grafico_area: Para visualizar volume ao longo do tempo
   - labels: Array de períodos
   - values: Array de valores
   - metadados.formatoMonetario: true (para valores em R$)

6. grafico_pizza: Para distribuições percentuais
   - labels: Array de categorias
   - values: Array de valores

7. grafico_scatter: Para correlações entre variáveis
   - pontos: Array de objetos {x, y, nome}
   - labelX: Rótulo do eixo X
   - labelY: Rótulo do eixo Y

8. grafico_radar: Para comparar múltiplas métricas
   - labels: Array de dimensões
   - values: Array de valores (0-100)

9. tabela: Para dados detalhados
   - colunas: Array de nomes das colunas
   - linhas: Array de arrays com dados

REGRAS IMPORTANTES:
1. O PRIMEIRO widget SEMPRE deve ser do tipo "explicacao" descrevendo a análise
2. SEMPRE retorne JSON válido, nunca texto livre
3. Use gráficos de linha/área para dados temporais (vendas por mês, evolução, etc)
4. Use scatter para correlações (ex: preço vs quantidade vendida)
5. Use radar para comparar métricas múltiplas (ex: performance de vendedores)
6. Escolha os widgets mais adequados para responder a pergunta
7. Use dados reais fornecidos no contexto
8. Seja visual e informativo
9. Priorize insights acionáveis
10. Organize widgets de forma lógica: explicação → métricas principais → gráficos → detalhes
11. SEMPRE adicione metadados.formatoMonetario: true quando os valores forem monetários (vendas, receita, preço, etc)
12. Valores em cards devem ser formatados como "R$ 150.000,00" quando forem monetários`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, dataInicio, dataFim } = await request.json();

    // Obter usuário autenticado (MESMA LÓGICA DO CHAT)
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');
    let userId = 0;
    let userName = 'Usuário';
    let idEmpresa = 0;

    if (!userCookie) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = JSON.parse(userCookie.value);
    userId = user.id;
    userName = user.name || 'Usuário';
    idEmpresa = user.ID_EMPRESA || user.id_empresa || 0;

    // Validar acesso à Análise de Dados
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return NextResponse.json(
          { error: accessControlService.getRestrictedFeatureMessage('Análise de Dados') },
          { status: 403 }
        );
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }

    if (!idEmpresa) {
      return new Response(JSON.stringify({ 
        error: 'Empresa não identificada',
        widgets: []
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar chave API do Gemini da empresa
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Chave API do Gemini não configurada para esta empresa',
        widgets: []
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);

    // Definir período padrão (últimos 30 dias) se não fornecido
    const hoje = new Date();
    const filtro: FiltroAnalise = {
      dataFim: dataFim || hoje.toISOString().split('T')[0],
      dataInicio: dataInicio || new Date(hoje.setDate(hoje.getDate() - 30)).toISOString().split('T')[0],
      idEmpresa // IMPORTANTE: passar idEmpresa no filtro
    };

    console.log(`📅 Filtro de análise: ${filtro.dataInicio} a ${filtro.dataFim} - Empresa: ${idEmpresa}`);

    // Validar acesso e obter filtros
    const userAccess = await accessControlService.validateUserAccess(userId, idEmpresa);

    console.log('🔐 Filtros de acesso para IA:', {
      isAdmin: userAccess.isAdmin,
      codVendedor: userAccess.codVendedor,
      vendedoresEquipe: userAccess.vendedoresEquipe
    });

    // Buscar dados do Oracle com filtros de acesso
    const dados = await buscarDadosAnalise(
      filtro,
      userId,
      userAccess.isAdmin,
      idEmpresa
    );

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DADOS CARREGADOS DA EMPRESA:', idEmpresa);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Leads: ${dados.totalLeads || dados.leads.length}`);
    console.log(`   Atividades: ${dados.totalAtividades || dados.atividades.length}`);
    console.log(`   Pedidos: ${dados.totalPedidos || dados.pedidos.length} (Total: R$ ${(dados.valorTotalPedidos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
    console.log(`   Produtos nos Leads: ${dados.produtosLeads?.length || 0}`);
    console.log(`   Clientes: ${dados.totalClientes || dados.clientes.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Calcular maiores clientes (mesmo cálculo do chat)
    const pedidosPorCliente = dados.pedidos.reduce((acc: any, p: any) => {
      const nomeCliente = p.NOMEPARC || p.Parceiro_NOMEPARC || 'Cliente Desconhecido';
      const codParc = p.CODPARC || 'SEM_CODIGO';
      const key = `${codParc}|${nomeCliente}`;

      if (!acc[key]) {
        acc[key] = {
          codigo: codParc,
          nome: nomeCliente,
          total: 0,
          qtdPedidos: 0,
          pedidos: []
        };
      }
      const valor = parseFloat(p.VLRNOTA) || 0;
      acc[key].total += valor;
      acc[key].qtdPedidos += 1;
      acc[key].pedidos.push({
        nunota: p.NUNOTA,
        valor: valor,
        data: p.DTNEG
      });
      return acc;
    }, {});

    const maioresClientes = Object.values(pedidosPorCliente)
      .sort((a: any, b: any) => b.total - a.total)
      .map((c: any) => ({
        codigo: c.codigo,
        nome: c.nome,
        totalPedidos: c.qtdPedidos,
        valorTotal: c.total,
        ticketMedio: c.total / c.qtdPedidos,
        pedidos: c.pedidos
      }));

    // Usar EXATAMENTE o mesmo contexto do chat
    const contextPrompt = `CONTEXTO DO SISTEMA (${filtro.dataInicio} a ${filtro.dataFim}):

📊 NÚMEROS EXATOS DO SISTEMA (USE ESTES NÚMEROS, NÃO INVENTE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
→ LEADS: ${dados.totalLeads || dados.leads.length}
→ ATIVIDADES: ${dados.totalAtividades || dados.atividades.length}
→ PEDIDOS: ${dados.totalPedidos || dados.pedidos.length} (Total: R$ ${(dados.valorTotalPedidos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
→ PRODUTOS NOS LEADS: ${dados.produtosLeads?.length || 0}
→ CLIENTES: ${dados.totalClientes || dados.clientes.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 FUNIS E ESTÁGIOS:
${dados.funis.map((f: any) => {
  const estagios = dados.estagiosFunis.filter((e: any) => e.CODFUNIL === f.CODFUNIL);
  const leadsNoFunil = dados.leads.filter((l: any) => l.CODFUNIL === f.CODFUNIL);
  return `• ${f.NOME} (${estagios.length} estágios, ${leadsNoFunil.length} leads)
  ${estagios.map((e: any) => {
    const leadsNoEstagio = dados.leads.filter((l: any) => l.CODESTAGIO === e.CODESTAGIO);
    return `  - ${e.NOME}: ${leadsNoEstagio.length} leads`;
  }).join('\n')}`;
}).join('\n')}

${dados.totalLeads && dados.totalLeads > 0 ? `💰 LEADS NO PIPELINE (${dados.totalLeads}):
${dados.leads.slice(0, 20).map((l: any) => {
  const estagio = dados.estagiosFunis.find((e: any) => e.CODESTAGIO === l.CODESTAGIO);
  const funil = dados.funis.find((f: any) => f.CODFUNIL === l.CODFUNIL);
  const produtos = dados.produtosLeads.filter((p: any) => p.CODLEAD === l.CODLEAD);
  return `• ${l.NOME} - R$ ${(l.VALOR || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
  Status: ${l.STATUS_LEAD || 'EM_ANDAMENTO'}
  Estágio: ${estagio?.NOME || 'Sem estágio'} (Funil: ${funil?.NOME || 'Sem funil'})
  ${produtos.length > 0 ? `Produtos: ${produtos.map((p: any) => p.DESCRPROD).join(', ')}` : ''}`;
}).join('\n\n')}` : ''}

${dados.totalAtividades && dados.totalAtividades > 0 ? `📋 ATIVIDADES (${dados.totalAtividades}):
${dados.atividades.slice(0, 20).map((a: any) => {
  const lead = dados.leads.find((l: any) => l.CODLEAD === a.CODLEAD);
  const desc = a.DESCRICAO?.split('|')[0] || a.DESCRICAO || 'Sem descrição';
  const status = a.STATUS || 'AGUARDANDO';
  const tipo = a.TIPO || '';

  let dataFormatada = 'Sem data';
  if (a.DATA_INICIO) {
    try {
      const data = new Date(a.DATA_INICIO);
      if (!isNaN(data.getTime())) {
        dataFormatada = data.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      dataFormatada = 'Data inválida';
    }
  }

  return `• ${desc.substring(0, 60)}
  Tipo: ${tipo} | Status: ${status} | Data: ${dataFormatada}
  ${lead ? `Lead: ${lead.NOME}` : 'Sem lead associado'}`;
}).join('\n\n')}` : ''}

${dados.totalPedidos && dados.totalPedidos > 0 ? `💵 PEDIDOS DE VENDA FINALIZADOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL EXATO: ${dados.totalPedidos} pedidos
VALOR TOTAL: R$ ${(dados.valorTotalPedidos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${maioresClientes && maioresClientes.length > 0 ? `🏆 ANÁLISE DE CLIENTES POR VALOR TOTAL (JÁ CALCULADO):

Os ${maioresClientes.length} principais clientes por valor total:

${maioresClientes.slice(0, 20).map((c: any, idx: number) => `
${idx + 1}º) ${c.nome} (Código: ${c.codigo})
   • Total de Pedidos: ${c.totalPedidos}
   • Valor Total: R$ ${(c.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
   • Ticket Médio: R$ ${(c.ticketMedio || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')}` : 'Nenhum cliente com pedidos'}` : 'Nenhum pedido de venda registrado no período.'}

${dados.totalEstoques && dados.totalEstoques > 0 ? `📦 PRODUTOS COM ESTOQUE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGISTROS DE ESTOQUE: ${dados.estoques.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 ESTOQUES (DADOS REAIS):
${dados.estoques.slice(0, 20).map((e: any) => {
  const produto = dados.produtos.find((p: any) => p.CODPROD === e.CODPROD);
  return `• Produto: ${produto?.DESCRPROD || 'Desconhecido'} (Código: ${e.CODPROD})
  Local: ${e.CODLOCAL}
  Estoque: ${parseFloat(e.ESTOQUE).toFixed(2)} ${produto?.UNIDADE || ''}`;
}).join('\n\n')}

${dados.estoques.length > 20 ? `... e mais ${dados.estoques.length - 20} registros de estoque` : ''}` : ''}

${dados.totalFinanceiro && dados.totalFinanceiro > 0 ? `💰 FINANCEIRO - TÍTULOS A RECEBER:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DE TÍTULOS: ${dados.totalFinanceiro}
VALOR TOTAL: R$ ${(dados.valorTotalFinanceiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
VALOR RECEBIDO: R$ ${(dados.valorRecebido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
VALOR PENDENTE: R$ ${(dados.valorPendente || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TÍTULOS (DADOS REAIS):
${dados.financeiro.slice(0, 20).map((f: any) => {
  const vlrDesdob = parseFloat(f.VLRDESDOB) || 0;
  const vlrBaixa = parseFloat(f.VLRBAIXA) || 0;
  const baixado = f.DHBAIXA ? 'Baixado' : 'Pendente';
  const provisao = f.PROVISAO === 'S' ? 'Provisão' : 'Real';

  return `• Título ${f.NUFIN} - ${f.NOMEPARC || 'Cliente não identificado'}
  Valor: R$ ${vlrDesdob.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
  Status: ${baixado} ${baixado === 'Baixado' ? `(R$ ${vlrBaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}
  Tipo: ${provisao} | Vencimento: ${f.DTVENC || 'Sem data'}
  ${f.NUMNOTA ? `Nota Fiscal: ${f.NUMNOTA}` : 'Lançamento Direto'}`;
}).join('\n\n')}

${dados.financeiro.length > 20 ? `... e mais ${dados.financeiro.length - 20} títulos` : ''}` : 'Nenhum título financeiro registrado no período.'}

PERGUNTA DO USUÁRIO:
${prompt}

IMPORTANTE: Retorne APENAS o JSON estruturado com os widgets. Não adicione texto explicativo antes ou depois do JSON.`;

    // Usar modelo gemini-2.5-flash com chave da empresa
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8000,
      }
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: contextPrompt }
    ]);

    const responseText = result.response.text();

    // Extrair JSON da resposta (remover markdown se houver)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsedResponse = JSON.parse(jsonText);

    console.log('✅ Análise gerada com sucesso - Widgets:', parsedResponse.widgets?.length || 0);

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Erro na análise Gemini:', error);
    return new Response(JSON.stringify({ 
      error: 'Erro ao processar análise',
      widgets: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}