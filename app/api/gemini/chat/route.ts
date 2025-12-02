import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cookies } from 'next/headers';
import { getCacheService } from '@/lib/redis-cache-cache-wrapper'; // Corrected import path
import { contratosService } from '@/lib/contratos-service';

// Função helper para fetch com timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`⚠️ Timeout/erro ao buscar ${url}:`, error);
    throw error;
  }
}

// Função para buscar dados do sistema com filtro de data
async function analisarDadosDoSistema(userId: number, userName: string, isAdmin: boolean = false, idEmpresa: number, filtroFrontend?: { dataInicio: string, dataFim: string }) {
  try {
    // Usar filtro do frontend se disponível, senão usar padrão: últimos 90 dias
    let filtro;
    if (filtroFrontend && filtroFrontend.dataInicio && filtroFrontend.dataFim) {
      filtro = filtroFrontend;
    } else {
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - 90);
      filtro = {
        dataInicio: dataInicio.toISOString().split('T')[0],
        dataFim: dataFim.toISOString().split('T')[0]
      };
    }

    console.log('📅 Filtro de análise:', filtro);

    // Log detalhado do usuário
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 INFORMAÇÕES DO USUÁRIO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Nome: ${userName}`); // Substituído currentUser.name por userName
    console.log(`   User ID: ${userId}`);
    console.log(`   Empresa ID: ${idEmpresa}`);
    console.log(`   É Administrador: ${isAdmin ? 'SIM' : 'NÃO'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


    // Importar serviço de análise dinamicamente
    const { buscarDadosAnalise } = await import('@/lib/analise-service');

    // Buscar TODOS os dados direto do Oracle
    const dadosCompletos = await buscarDadosAnalise(filtro, userId, isAdmin, idEmpresa);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DADOS CARREGADOS DA EMPRESA:', idEmpresa);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Leads: ${dadosCompletos.leads.length}`);
    console.log(`   Atividades: ${dadosCompletos.atividades.length}`);
    console.log(`   Pedidos: ${dadosCompletos.pedidos.length}`);
    console.log(`   Clientes: ${dadosCompletos.clientes.length}`);
    console.log(`   Financeiro: ${dadosCompletos.financeiro.length}`);
    console.log(`   Funis: ${dadosCompletos.funis.length}`);
    console.log(`   Estágios: ${dadosCompletos.estagiosFunis.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');


    // Calcular métricas
    const valorTotalPedidos = dadosCompletos.pedidos.reduce((sum, p) => sum + (parseFloat(p.VLRNOTA) || 0), 0);
    const valorTotalFinanceiro = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRDESDOB) || 0), 0);
    const valorRecebido = dadosCompletos.financeiro.reduce((sum, f) => sum + (parseFloat(f.VLRBAIXA) || 0), 0);

    // Calcular maiores clientes
    const pedidosPorCliente = dadosCompletos.pedidos.reduce((acc: any, p: any) => {
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
        codigo: c.codparc,
        nome: c.nome,
        totalPedidos: c.qtdPedidos,
        valorTotal: c.total,
        ticketMedio: c.total / c.qtdPedidos,
        pedidos: c.pedidos
      }));

    return {
      leads: dadosCompletos.leads,
      atividades: dadosCompletos.atividades,
      pedidos: dadosCompletos.pedidos,
      clientes: dadosCompletos.clientes,
      financeiro: dadosCompletos.financeiro,
      funis: dadosCompletos.funis,
      estagiosFunis: dadosCompletos.estagiosFunis,
      userName,
      filtro,
      // Métricas calculadas
      totalLeads: dadosCompletos.leads.length,
      totalAtividades: dadosCompletos.atividades.length,
      totalPedidos: dadosCompletos.pedidos.length,
      totalClientes: dadosCompletos.clientes.length,
      totalFinanceiro: dadosCompletos.financeiro.length,
      valorTotalPedidos,
      valorTotalFinanceiro,
      valorRecebido,
      valorPendente: valorTotalFinanceiro - valorRecebido,
      maioresClientes
    };
  } catch (error) {
    console.error('❌ Erro ao analisar dados do sistema:', error);
    return {
      leads: [],
      atividades: [],
      pedidos: [],
      clientes: [],
      financeiro: [],
      funis: [],
      estagiosFunis: [],
      userName,
      filtro: { dataInicio: '', dataFim: '' },
      totalLeads: 0,
      totalAtividades: 0,
      totalPedidos: 0,
      totalClientes: 0,
      totalFinanceiro: 0,
      valorTotalPedidos: 0,
      valorTotalFinanceiro: 0,
      valorRecebido: 0,
      valorPendente: 0,
      maioresClientes: []
    };
  }
}

const SYSTEM_PROMPT = `Você é um Assistente de Vendas da Sankhya, especializado em ajudar vendedores a gerenciar leads e fechar negócios.

🎯 REGRAS FUNDAMENTAIS DE COMUNICAÇÃO:

1. **NUNCA retorne JSON, código ou dados técnicos nas respostas**
2. **SEMPRE responda em linguagem natural, clara e objetiva**
3. **NUNCA mencione nomes de tabelas, colunas ou termos técnicos do banco de dados**
4. **Use termos simples**: ao invés de "AD_LEADS.VALOR", diga "valor do lead"; ao invés de "CODPARC", diga "cliente"
5. **Seja conversacional e amigável**, como se estivesse falando com um colega de trabalho
6. **Foque em insights práticos e ações**, não em explicações técnicas

🗂️ CONHECIMENTO DO SISTEMA:

Você tem acesso aos seguintes dados do CRM:
- **Leads**: Oportunidades de venda em diferentes estágios do funil
- **Atividades**: Tarefas, ligações, reuniões e eventos relacionados aos leads  
- **Pedidos**: Vendas finalizadas e faturadas
- **Produtos**: Catálogo de produtos disponíveis com estoque
- **Clientes**: Base de parceiros e clientes cadastrados
- **Financeiro**: Títulos a receber (contas a receber dos clientes)
- **Funis**: Etapas do processo de vendas (ex: Prospecção → Negociação → Fechamento)

📊 COMO INTERPRETAR OS DADOS:

Você receberá dados estruturados, mas ao responder:
- Transforme números em insights ("você tem 15 leads ativos no valor total de R$ 250.000")
- Identifique padrões ("3 leads estão parados há mais de 7 dias sem atividade")
- Sugira ações práticas ("priorize o lead 'Empresa XYZ' pois tem alto valor e está no estágio final")
- Use nomes reais dos leads, clientes e produtos (não códigos)
`;



// Cache de dados por sessão
const sessionDataCache = new Map<string, { data: any; filtro: string }>();

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies(); // Moved import to top
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || user.id_empresa || 0; // Handle potential variations in key name

    if (!idEmpresa) {
      return new Response(JSON.stringify({ error: 'Empresa não identificada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar chave API do Gemini da empresa
    const contrato = await contratosService.getContratoByEmpresa(idEmpresa);

    if (!contrato || !contrato.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Chave API do Gemini não configurada para esta empresa' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(contrato.GEMINI_API_KEY);

    // Validar acesso à IA
    const { accessControlService } = await import('@/lib/access-control-service');

    let userAccess;

    try {
      userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      // Verifica se o usuário tem permissão para usar funcionalidades restritas
      if (!accessControlService.canAccessRestrictedFeatures(userAccess)) {
        return new Response(JSON.stringify({
          error: accessControlService.getRestrictedFeatureMessage('IA Chat')
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (accessError: any) {
      console.error('Erro de controle de acesso:', accessError);
      return new Response(JSON.stringify({ error: accessError.message }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { message, history, filtro, sessionId } = await request.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = userAccess.isAdmin; // Use the validated userAccess

    const { searchParams } = new URL(request.url);
    const pergunta = searchParams.get('pergunta') || '';

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      }
    });

    // Montar histórico com prompt de sistema
    const chatHistory = [
      {
        role: 'user',
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido! Estou pronto para analisar seus dados.' }],
      },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }))
    ];

    // Verificar se precisa carregar dados
    let messageWithContext = message;
    const filtroKey = JSON.stringify(filtro);
    const cacheKey = `${sessionId}-${idEmpresa}`;
    const cached = sessionDataCache.get(cacheKey);

    const needsReload = !cached || cached.filtro !== filtroKey;

    if (history.length === 0 || needsReload) {
      console.log(needsReload ? '🔄 Filtro alterado - Recarregando dados...' : '🔍 Primeiro prompt - Carregando dados...');

      const dadosSistema = await analisarDadosDoSistema(user.id, user.name, isAdmin, idEmpresa, filtro); // Use validated user data

      // Preparar dados em JSON compacto
      const contextData = {
        periodo: { inicio: dadosSistema.filtro.dataInicio, fim: dadosSistema.filtro.dataFim },
        resumo: {
          leads: dadosSistema.totalLeads,
          atividades: dadosSistema.totalAtividades,
          pedidos: dadosSistema.totalPedidos,
          valorPedidos: dadosSistema.valorTotalPedidos,
          valorFinanceiro: dadosSistema.valorTotalFinanceiro
        },
        leads: dadosSistema.leads.map((l: any) => ({
          id: l.CODLEAD,
          nome: l.NOME,
          valor: l.VALOR,
          status: l.STATUS_LEAD,
          estagio: dadosSistema.estagiosFunis.find((e: any) => e.CODESTAGIO === l.CODESTAGIO)?.NOME
        })),
        atividades: dadosSistema.atividades.map((a: any) => ({
          id: a.CODATIVIDADE,
          tipo: a.TIPO,
          status: a.STATUS,
          data: a.DATA_INICIO,
          TITULO: a.TITULO,
          CODLEAD: a.CODLEAD
        })),
        clientes: dadosSistema.maioresClientes.slice(0, 10).map((c: any) => ({
          nome: c.nome,
          pedidos: c.totalPedidos,
          valor: c.valorTotal
        })),
        funis: dadosSistema.funis.length,
        estagios: dadosSistema.estagiosFunis.length
      };

      // Salvar no cache
      sessionDataCache.set(cacheKey, { data: contextData, filtro: filtroKey });

      messageWithContext = `DADOS (JSON):
${JSON.stringify(contextData)}

PERGUNTA: ${message}`;

      console.log('✅ Contexto carregado:', {
        periodo: contextData.periodo,
        totais: contextData.resumo
      });
    } else {
      console.log('💾 Usando cache de dados');
      messageWithContext = message;
    }

    const chat = model.startChat({
      history: chatHistory,
    });

    // Usar streaming com contexto
    const result = await chat.sendMessageStream(messageWithContext);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let chunkCount = 0;
        let totalChars = 0;

        try {
          console.log('🚀 Iniciando streaming da resposta...');

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              chunkCount++;
              totalChars += text.length;

              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));

              // Log a cada 5 chunks para não poluir
              if (chunkCount % 5 === 0) {
                console.log(`📤 Enviado chunk ${chunkCount} (${totalChars} caracteres até agora)`);
              }
            }
          }

          console.log(`✅ Streaming concluído: ${chunkCount} chunks, ${totalChars} caracteres totais`);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error: any) {
          console.error('❌ Erro no streaming do Gemini:', error);
          console.error('Stack trace:', error.stack);

          const errorMessage = `data: ${JSON.stringify({
            error: 'Erro ao processar resposta. Por favor, tente novamente.'
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Erro no chat Gemini:', error);
    return new Response(JSON.stringify({ error: 'Erro ao processar mensagem' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}