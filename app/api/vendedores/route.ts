import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mock functions for demonstration - replace with actual data fetching logic
async function consultarGerentes(idEmpresa: string): Promise<any[]> {
  console.log(`Consultando gerentes para a empresa ${idEmpresa} do cache`);
  // In a real application, this would fetch from a server-side cache or database
  // For this example, we'll return a placeholder
  return [{ CODGER: 'G001', NOMGER: 'Gerente A' }, { CODGER: 'G002', NOMGER: 'Gerente B' }];
}

async function consultarVendedores(idEmpresa: string, codGerente?: number): Promise<any[]> {
  console.log(`Consultando vendedores para a empresa ${idEmpresa}${codGerente ? ` do gerente ${codGerente}` : ''} do cache`);
  // In a real application, this would fetch from a server-side cache or database
  // For this example, we'll return a placeholder
  const allVendedores = [
    { CODGER: 'G001', CODVEND: 'V001', NOMVEND: 'Vendedor 1', TIPVEND: 'V' },
    { CODGER: 'G001', CODVEND: 'V002', NOMVEND: 'Vendedor 2', TIPVEND: 'V' },
    { CODGER: 'G002', CODVEND: 'V003', NOMVEND: 'Vendedor 3', TIPVEND: 'V' },
  ];
  if (codGerente) {
    return allVendedores.filter(v => v.CODGER === `G${codGerente}`);
  }
  return allVendedores.filter(v => v.TIPVEND === 'V');
}

export async function GET(request: Request) {
  try {
    const cookieStore = cookies()
    const userCookie = cookieStore.get('user')

    if (!userCookie) {
      return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
    }

    const user = JSON.parse(userCookie.value)
    const idEmpresa = user.ID_EMPRESA

    if (!idEmpresa) {
      return NextResponse.json({ error: 'Empresa não identificada' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const codGerente = searchParams.get('codGerente')

    if (!tipo) {
      return NextResponse.json({ error: 'Tipo não especificado' }, { status: 400 });
    }

    if (tipo === 'gerentes') {
      const gerentes = await consultarGerentes(idEmpresa);
      return NextResponse.json(gerentes);
    } else if (tipo === 'vendedores') {
      const vendedores = await consultarVendedores(
        idEmpresa,
        codGerente ? parseInt(codGerente) : undefined
      );
      return NextResponse.json(vendedores);
    }

    return NextResponse.json({ error: 'Tipo não especificado' }, { status: 400 });
  } catch (error: any) {
    console.error('Erro ao consultar vendedores:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar vendedores' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';