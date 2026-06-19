import { NextRequest, NextResponse } from "next/server";

// Função para mapear o formato do Minha Receita para o formato do BrasilAPI
function mapMinhaReceitaToBrasilAPI(data: any) {
  const situacoes: Record<number, string> = {
    1: "NULA",
    2: "ATIVA",
    3: "SUSPENSA",
    4: "INAPTA",
    5: "BAIXADA"
  };
  
  return {
    cnpj: data.cnpj || "",
    razao_social: data.razao_social || "",
    nome_fantasia: data.nome_fantasia || "",
    descricao_situacao_cadastral: situacoes[data.situacao_cadastral] || "ATIVA",
    data_inicio_atividade: data.data_inicio_atividade || "",
    uf: data.uf || "",
    municipio: data.municipio || "",
    bairro: data.bairro || "",
    logradouro: data.logradouro || "",
    numero: data.numero || "",
    complemento: data.complemento || "",
    cep: data.cep || "",
    cnae_fiscal: data.cnae_fiscal || 0,
    cnae_fiscal_descricao: data.cnae_fiscal_descricao || "Atividade principal",
    natureza_juridica: data.natureza_juridica || data.codigo_natureza_juridica || "",
    opcao_pelo_simples: data.opcao_pelo_simples ?? false,
    data_opcao_pelo_simples: data.data_opcao_pelo_simples || null,
    opcao_pelo_mei: data.opcao_pelo_mei ?? false,
    email: data.email || data.correio_eletronico || null,
    ddd_telefone_1: data.ddd_telefone_1 || null,
    ddd_telefone_2: data.ddd_telefone_2 || null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  const { cnpj } = await params;
  const cleanCnpj = cnpj.replace(/\D/g, "");

  if (cleanCnpj.length !== 14) {
    return NextResponse.json(
      { error: "CNPJ inválido" },
      { status: 400 }
    );
  }

  // Provedores em ordem de fallback
  // 1. BrasilAPI (Principal)
  // 2. Minha Receita (Excelente fallback, sem bloqueio de IP de nuvem)
  
  try {
    console.log(`[Proxy] Tentando consultar CNPJ ${cleanCnpj} via BrasilAPI...`);
    const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000), // Timeout de 6 segundos para não travar
    });

    if (brasilApiResponse.ok) {
      const data = await brasilApiResponse.json();
      console.log(`[Proxy] CNPJ ${cleanCnpj} encontrado com sucesso na BrasilAPI!`);
      return NextResponse.json(data);
    }
    
    console.warn(`[Proxy] BrasilAPI falhou com status ${brasilApiResponse.status}. Tentando fallback para Minha Receita.`);
  } catch (err: any) {
    console.error(`[Proxy] Erro de conexão com BrasilAPI: ${err.message}. Tentando fallback...`);
  }

  // Fallback 1: Minha Receita (API robusta, aberta)
  try {
    console.log(`[Proxy] Tentando consultar CNPJ ${cleanCnpj} via Minha Receita...`);
    const minhaReceitaResponse = await fetch(`https://minhareceita.org/${cleanCnpj}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });

    if (minhaReceitaResponse.ok) {
      const rawData = await minhaReceitaResponse.json();
      if (rawData && rawData.cnpj) {
        const mappedData = mapMinhaReceitaToBrasilAPI(rawData);
        console.log(`[Proxy] CNPJ ${cleanCnpj} encontrado com sucesso via Minha Receita!`);
        return NextResponse.json(mappedData);
      }
    }
    
    console.warn(`[Proxy] Minha Receita falhou com status ${minhaReceitaResponse.status}.`);
  } catch (err: any) {
    console.error(`[Proxy] Erro de conexão com Minha Receita: ${err.message}`);
  }

  // Se ambos falharem no servidor, retorna o erro informando que as APIs estão indisponíveis
  // para que o cliente possa fazer a última tentativa via client-side fetch direto do navegador (contornando o IP da nuvem)
  return NextResponse.json(
    { 
      error: "Serviço de consulta offline", 
      details: "Os servidores da BrasilAPI e Minha Receita retornaram erro. Tentando conexão local..." 
    },
    { status: 503 }
  );
}
