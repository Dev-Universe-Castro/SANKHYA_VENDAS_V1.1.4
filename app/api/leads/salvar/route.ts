import { NextResponse } from 'next/server';
import { salvarLead, adicionarProdutoLead } from '@/lib/oracle-leads-service';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('user');

    if (!userCookie) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const user = JSON.parse(userCookie.value);
    const idEmpresa = user.ID_EMPRESA || 1;
    const codUsuarioCriador = user.id;

    // Validar se o usuário pode criar leads
    const { accessControlService } = await import('@/lib/access-control-service');

    try {
      const userAccess = await accessControlService.validateUserAccess(user.id, idEmpresa);

      if (!accessControlService.canCreateOrEdit(userAccess)) {
        const errorMsg = accessControlService.getAccessDeniedMessage(userAccess);
        return NextResponse.json({ error: errorMsg }, { status: 403 });
      }
    } catch (accessError: any) {
      return NextResponse.json({ error: accessError.message }, { status: 403 });
    }

    const leadData = await request.json();

    console.log('📥 Dados recebidos na API /api/leads/salvar:', JSON.stringify(leadData, null, 2));
    console.log('🔑 CODPARC recebido:', leadData.CODPARC);

    // Passar o ID do usuário criador se for um novo lead
    // A validação de acesso já garante que o usuário tem permissão para criar
    const finalCodUsuarioCriador = leadData.CODLEAD ? undefined : codUsuarioCriador;

    // Extrair produtos do leadData
    const produtos = leadData.PRODUTOS || [];
    delete leadData.PRODUTOS;

    console.log('🛒 Produtos extraídos do leadData:', {
      quantidade: produtos.length,
      produtos: produtos
    });

    // Salvar lead no Oracle
    const leadSalvo = await salvarLead(leadData, idEmpresa, finalCodUsuarioCriador);

    console.log('✅ Lead salvo com sucesso:', {
      CODLEAD: leadSalvo.CODLEAD,
      NOME: leadSalvo.NOME
    });

    // Salvar produtos vinculados APENAS se for um lead novo (sem CODLEAD no leadData)
    const isNovoLead = !leadData.CODLEAD;
    if (isNovoLead && produtos && produtos.length > 0 && leadSalvo.CODLEAD) {
      console.log(`📦 Iniciando salvamento de ${produtos.length} produto(s) para lead novo...`);

      // Aguardar um delay maior para garantir que o lead foi persistido
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < produtos.length; i++) {
        const produto = produtos[i];

        // Validar se o produto tem dados mínimos necessários
        if (!produto.CODPROD || !produto.DESCRPROD) {
          console.warn(`⚠️ Produto ${i + 1} sem dados essenciais, pulando:`, produto);
          continue;
        }

        console.log(`📌 Salvando produto ${i + 1}/${produtos.length}:`, {
          CODLEAD: String(leadSalvo.CODLEAD),
          CODPROD: produto.CODPROD,
          DESCRPROD: produto.DESCRPROD,
          QUANTIDADE: produto.QUANTIDADE || produto.QTDNEG || 1,
          VLRUNIT: produto.VLRUNIT || 0,
          VLRTOTAL: produto.VLRTOTAL || 0
        });

        try {
          await adicionarProdutoLead({
            CODLEAD: String(leadSalvo.CODLEAD),
            ID_EMPRESA: idEmpresa,
            CODPROD: produto.CODPROD,
            DESCRPROD: produto.DESCRPROD,
            QUANTIDADE: produto.QUANTIDADE || produto.QTDNEG || 1,
            VLRUNIT: produto.VLRUNIT || 0,
            VLRTOTAL: produto.VLRTOTAL || 0
          }, idEmpresa);
          console.log(`✅ Produto ${i + 1} salvo com sucesso`);

          // Delay entre produtos para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (produtoError: any) {
          console.error(`❌ Erro ao salvar produto ${i + 1}:`, produtoError);
          throw new Error(`Falha ao salvar produto "${produto.DESCRPROD}": ${produtoError.message}`);
        }
      }

      console.log('✅ Todos os produtos foram salvos com sucesso');
    } else {
      console.log('⚠️ Nenhum produto para salvar:', {
        temProdutos: produtos && produtos.length > 0,
        temCodLead: !!leadSalvo.CODLEAD,
        produtos: produtos
      });
    }

    return NextResponse.json(leadSalvo);
  } catch (error: any) {
    console.error('❌ Erro ao salvar lead:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar lead' },
      { status: 500 }
    );
  }
}