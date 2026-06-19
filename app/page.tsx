'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Download, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Copy, 
  UserCog, 
  Sun, 
  Moon, 
  Building2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState<any[]>([]);
  
  // Estado para o Modo Escuro
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Formata CNPJ para exibição (XX.XXX.XXX/0001-XX)
  const formatCNPJ = (value: string) => {
    return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  // Limpa caracteres não numéricos
  const cleanCNPJ = (value: string) => {
    return value.replace(/\D/g, '');
  };

  // Helper para verificar se um campo tem valor válido
  const hasValue = (val: any) => val && typeof val === 'string' && val.trim() !== '';

  // Função principal de consulta
  const handleConsult = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    setResults([]);
    setErrors([]);
    
    // Separa os CNPJs por quebra de linha, vírgula ou espaço
    const rawList = inputText.split(/[\n,;]+/).map(item => item.trim()).filter(item => item !== '');
    const uniqueList = [...new Set(rawList)]; // Remove duplicatas
    
    setProgress({ current: 0, total: uniqueList.length });

    const newResults: any[] = [];
    const newErrors: any[] = [];

    // Processa as requisições
    for (let i = 0; i < uniqueList.length; i++) {
      const rawCnpj = uniqueList[i];
      const numbersOnly = cleanCNPJ(rawCnpj);

      // Validação básica de tamanho
      if (numbersOnly.length !== 14) {
        newErrors.push({ cnpj: rawCnpj, msg: 'Formato inválido (14 dígitos)' });
        setProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }

      try {
        let data;
        let success = false;
        let lastErrorMessage = '';

        // Tentativa 1: Proxy do próprio servidor (que tenta BrasilAPI e Minha Receita)
        try {
          const response = await fetch(`/api/cnpj/${numbersOnly}`);
          if (response.ok) {
            data = await response.json();
            success = true;
          } else {
            const errData = await response.json().catch(() => ({}));
            lastErrorMessage = response.status === 404 ? 'CNPJ não encontrado' : errData.error || 'Erro na API remota';
          }
        } catch (err: any) {
          lastErrorMessage = err.message || 'Erro de rede no servidor';
        }

        // Tentativa 2: Se falhar, tenta chamar BrasilAPI diretamente do navegador (bypassa IP da nuvem)
        if (!success) {
          try {
            console.log(`[Frontend] Servidor falhou (${lastErrorMessage}). Tentando BrasilAPI diretamente do navegador...`);
            const clientResponse = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${numbersOnly}`);
            if (clientResponse.ok) {
              data = await clientResponse.json();
              success = true;
            } else {
              lastErrorMessage = clientResponse.status === 404 ? 'CNPJ não encontrado' : 'Erro na BrasilAPI direta';
            }
          } catch (err: any) {
            lastErrorMessage = 'Bloqueio de CORS ou rede local';
          }
        }

        // Tentativa 3: Se ainda falhar, tenta chamar Minha Receita diretamente do navegador
        if (!success) {
          try {
            console.log(`[Frontend] BrasilAPI direta falhou. Tentando Minha Receita diretamente do navegador...`);
            const clientResponse2 = await fetch(`https://minhareceita.org/${numbersOnly}`);
            if (clientResponse2.ok) {
              const rawData = await clientResponse2.json();
              if (rawData && rawData.cnpj) {
                // Função auxiliar interna para mapear formato
                const situacoes: Record<number, string> = { 1: "NULA", 2: "ATIVA", 3: "SUSPENSA", 4: "INAPTA", 5: "BAIXADA" };
                data = {
                  cnpj: rawData.cnpj || "",
                  razao_social: rawData.razao_social || "",
                  nome_fantasia: rawData.nome_fantasia || "",
                  descricao_situacao_cadastral: situacoes[rawData.situacao_cadastral] || "ATIVA",
                  data_inicio_atividade: rawData.data_inicio_atividade || "",
                  uf: rawData.uf || "",
                  municipio: rawData.municipio || "",
                  bairro: rawData.bairro || "",
                  logradouro: rawData.logradouro || "",
                  numero: rawData.numero || "",
                  complemento: rawData.complemento || "",
                  cep: rawData.cep || "",
                  cnae_fiscal: rawData.cnae_fiscal || 0,
                  cnae_fiscal_descricao: rawData.cnae_fiscal_descricao || "Atividade principal",
                  natureza_juridica: rawData.natureza_juridica || rawData.codigo_natureza_juridica || "",
                  opcao_pelo_simples: rawData.opcao_pelo_simples ?? false,
                  data_opcao_pelo_simples: rawData.data_opcao_pelo_simples || null,
                  opcao_pelo_mei: rawData.opcao_pelo_mei ?? false,
                  email: rawData.email || rawData.correio_eletronico || null,
                  ddd_telefone_1: rawData.ddd_telefone_1 || null,
                  ddd_telefone_2: rawData.ddd_telefone_2 || null,
                };
                success = true;
              }
            } else {
              lastErrorMessage = clientResponse2.status === 404 ? 'CNPJ não encontrado' : 'Erro no Minha Receita direto';
            }
          } catch (err: any) {
            lastErrorMessage = 'Falha crítica em todos os provedores';
          }
        }

        if (success && data) {
          newResults.push(data);
        } else {
          throw new Error(lastErrorMessage || 'Erro desconhecido');
        }
      } catch (err: any) {
        newErrors.push({ cnpj: formatCNPJ(numbersOnly) || rawCnpj, msg: err.message });
      }

      // Atualiza progresso visualmente
      setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setResults(newResults);
    setErrors(newErrors);
    setLoading(false);
  };

  // Função para exportar CSV
  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = [
      "CNPJ", "Razão Social", "Nome Fantasia", "Situação", "Data Abertura", 
      "Natureza Jurídica", "Simples Nacional", "MEI", "Email", "Telefone",
      "Estado", "Cidade", "Bairro", "Logradouro", "CNAE Principal"
    ];

    const rows = results.map(r => [
      formatCNPJ(r.cnpj),
      `"${r.razao_social}"`,
      `"${r.nome_fantasia || ''}"`,
      r.descricao_situacao_cadastral,
      r.data_inicio_atividade,
      `"${r.natureza_juridica}"`,
      r.opcao_pelo_simples ? "Sim" : "Não",
      r.opcao_pelo_mei ? "Sim" : "Não",
      hasValue(r.email) ? r.email : '',
      `"${r.ddd_telefone_1 || ''} ${r.ddd_telefone_2 ? ' / ' + r.ddd_telefone_2 : ''}"`,
      r.uf, r.municipio, r.bairro,
      `"${r.logradouro}, ${r.numero}"`,
      r.cnae_fiscal_descricao
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cnpjs_consultados.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setInputText('');
    setResults([]);
    setErrors([]);
    setProgress({ current: 0, total: 0 });
  };

  // Definição de Cores Baseada no Tema
  const theme = {
    bgApp: isDarkMode ? "bg-slate-950" : "bg-slate-50",
    bgCard: isDarkMode ? "bg-slate-900" : "bg-white",
    bgInner: isDarkMode ? "bg-slate-800/50" : "bg-slate-50",
    borderCard: isDarkMode ? "border-slate-800" : "border-slate-200",
    borderInner: isDarkMode ? "border-slate-700/50" : "border-slate-100",
    textMain: isDarkMode ? "text-slate-100" : "text-slate-900",
    textSub: isDarkMode ? "text-slate-400" : "text-slate-500",
    textLabel: isDarkMode ? "text-slate-500" : "text-slate-400",
    textValue: isDarkMode ? "text-slate-300" : "text-slate-700",
    inputBg: isDarkMode ? "bg-slate-950" : "bg-white",
    inputBorder: isDarkMode ? "border-slate-800" : "border-slate-300",
    btnSecondaryBg: isDarkMode ? "bg-slate-800 text-white border-transparent hover:bg-slate-700" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50",
    errorBg: isDarkMode ? "bg-red-950/20 border-red-900/50" : "bg-red-50 border-red-200",
    errorText: isDarkMode ? "text-red-400" : "text-red-700",
    errorTitle: isDarkMode ? "text-red-300" : "text-red-800"
  };

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-500 ${theme.bgApp}`}>
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 rounded-2xl shadow-sm border transition-all duration-300 ${theme.bgCard} ${theme.borderCard}`}
        >
          <div className="flex items-center gap-4 mb-4 lg:mb-0">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20 flex-shrink-0">
              <UserCog size={28} />
            </div>
            
            <div className="flex flex-col justify-center">
              <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight transition-colors ${theme.textMain}`}>
                Consulta <span className="text-blue-600">CNPJ</span>
              </h1>
              <p className={`text-sm font-medium mt-0.5 transition-colors ${theme.textSub}`}>
                Desenvolvido por Alan Moreno <span className="opacity-60 ml-1 font-normal">(v2.0)</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
             <div className="flex gap-3">
               {results.length > 0 && (
                <button 
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm font-semibold text-sm active:scale-95"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Exportar CSV</span>
                </button>
              )}
              <button 
                onClick={clearAll}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition-all shadow-sm font-semibold text-sm active:scale-95 ${theme.btnSecondaryBg}`}
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </div>

            {/* Toggle Switch Claro/Escuro */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`relative flex items-center w-16 h-8 rounded-full border-2 transition-all duration-300 focus:outline-none shrink-0 ${
                isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-blue-100 border-blue-200'
              }`}
              aria-label="Alternar Tema"
            >
              <div className={`absolute w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
                isDarkMode ? 'translate-x-[34px]' : 'translate-x-[2px]'
              }`}>
                {isDarkMode 
                  ? <Moon size={14} className="text-blue-600 fill-current" /> 
                  : <Sun size={14} className="text-amber-500 fill-current" />
                }
              </div>
            </button>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Input Section */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1 space-y-4"
          >
            <div className={`p-6 rounded-2xl shadow-sm border h-full flex flex-col transition-colors duration-300 ${theme.bgCard} ${theme.borderCard}`}>
              <label className={`block text-sm font-bold mb-2 transition-colors ${theme.textMain}`}>
                Lista de CNPJs
              </label>
              <p className={`text-xs mb-4 transition-colors ${theme.textLabel}`}>
                Insira os CNPJs separados por linha ou vírgula.
              </p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ex:&#10;00.000.000/0001-91&#10;12345678000199"
                className={`flex-1 w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-sm min-h-[300px] transition-all ${theme.inputBg} ${theme.inputBorder} ${theme.textMain} placeholder-slate-500`}
              />
              <button
                onClick={handleConsult}
                disabled={loading || !inputText.trim()}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all active:scale-[0.98]
                  ${loading || !inputText.trim() ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'}`}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processando ({progress.current}/{progress.total})
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Consultar CNPJs
                  </>
                )}
              </button>
            </div>
            
            {/* Error Log */}
            <AnimatePresence>
              {errors.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`border rounded-xl p-4 overflow-hidden transition-colors ${theme.errorBg}`}
                >
                  <h3 className={`font-bold text-sm flex items-center gap-2 mb-2 ${theme.errorTitle}`}>
                    <AlertCircle size={16} /> Falhas ({errors.length})
                  </h3>
                  <ul className={`text-xs space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar ${theme.errorText}`}>
                    {errors.map((err, idx) => (
                      <li key={idx} className="flex justify-between border-b border-red-500/10 pb-1 last:border-0">
                        <span className="font-mono">{err.cnpj}</span>
                        <span className="text-right ml-2">{err.msg}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Results Section */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 space-y-4"
          >
            <div className="flex justify-between items-center mb-1 px-1">
              <h2 className={`text-lg font-bold transition-colors ${theme.textMain}`}>
                Resultados <span className={`font-normal ml-1 ${theme.textLabel}`}>({results.length})</span>
              </h2>
            </div>

            {results.length === 0 && !loading && (
              <div className={`h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl transition-colors ${isDarkMode ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                <Building2 size={64} className="mb-4 opacity-20" />
                <p className="font-medium">Aguardando consulta...</p>
              </div>
            )}

            <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 pb-10 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {results.map((company, index) => (
                  <motion.div 
                    key={company.cnpj}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-6 rounded-2xl shadow-sm border transition-all duration-300 hover:border-blue-500/50 group ${theme.bgCard} ${theme.borderCard}`}
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                      <div className="flex-1">
                        <h3 className={`font-bold text-xl leading-tight transition-colors ${theme.textMain}`}>
                          {company.razao_social}
                        </h3>
                        <p className={`text-sm font-medium mt-1 transition-colors ${theme.textSub}`}>
                          {company.nome_fantasia || 'Sem Nome Fantasia'}
                        </p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0
                        ${company.descricao_situacao_cadastral === 'ATIVA' 
                          ? (isDarkMode ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-100') 
                          : (isDarkMode ? 'bg-red-900/30 text-red-400 border border-red-800/50' : 'bg-red-50 text-red-700 border border-red-100')}`}>
                        {company.descricao_situacao_cadastral === 'ATIVA' ? <CheckCircle size={14}/> : <XCircle size={14}/>}
                        {company.descricao_situacao_cadastral}
                      </div>
                    </div>

                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 text-sm p-5 rounded-xl border transition-colors ${theme.bgInner} ${theme.borderInner}`}>
                      <div className="space-y-4">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>CNPJ</span>
                          <div className={`font-mono flex items-center gap-2 text-base transition-colors ${theme.textValue}`}>
                            {formatCNPJ(company.cnpj)}
                            <button 
                              onClick={() => navigator.clipboard.writeText(formatCNPJ(company.cnpj))}
                              className="text-blue-500 hover:text-blue-400 transition-colors p-1"
                              title="Copiar"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>Data de Abertura</span>
                          <span className={`text-base transition-colors ${theme.textValue}`}>
                            {new Date(company.data_inicio_atividade).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>Localização</span>
                          <span className={`transition-colors ${theme.textValue} leading-relaxed block`}>
                            {company.logradouro}, {company.numero} {company.complemento ? `- ${company.complemento}` : ''} <br/>
                            {company.bairro}, {company.municipio} - {company.uf} <br/>
                            CEP: {company.cep}
                          </span>
                        </div>
                      </div>
                      
                      <div className="md:col-span-2 pt-4 border-t border-slate-700/10">
                        <span className={`text-[10px] font-bold uppercase tracking-widest block mb-2 transition-colors ${theme.textLabel}`}>Atividade Principal (CNAE)</span>
                        <span className={`text-xs px-3 py-2 rounded-lg border inline-block transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700 text-blue-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                          {company.cnae_fiscal} - {company.cnae_fiscal_descricao}
                        </span>
                      </div>

                      <div className="md:col-span-2 pt-4 border-t border-slate-700/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>Simples Nacional</span>
                          <div className={`font-semibold ${company.opcao_pelo_simples ? 'text-emerald-500' : theme.textValue}`}>
                            {company.opcao_pelo_simples ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle size={16} /> Optante
                                {company.data_opcao_pelo_simples && (
                                  <span className={`text-xs font-normal ${theme.textLabel}`}>
                                    (desde {new Date(company.data_opcao_pelo_simples).toLocaleDateString('pt-BR')})
                                  </span>
                                )}
                              </div>
                            ) : 'Não optante'}
                          </div>
                        </div>
                        <div>
                           <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>MEI</span>
                           <span className={`font-semibold ${company.opcao_pelo_mei ? 'text-emerald-500' : theme.textValue}`}>
                             {company.opcao_pelo_mei ? 'Sim' : 'Não'}
                           </span>
                        </div>
                      </div>

                      <div className="md:col-span-2 pt-4 border-t border-slate-700/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>Contato</span>
                            <span className={`transition-colors break-all ${theme.textValue}`}>
                               {hasValue(company.email) 
                                 ? <a href={`mailto:${company.email}`} className="text-blue-500 hover:text-blue-400 hover:underline font-medium">{company.email}</a> 
                                 : <span className={`italic text-xs ${theme.textLabel}`}>E-mail não informado</span>}
                            </span>
                         </div>
                         <div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest block mb-1 transition-colors ${theme.textLabel}`}>Telefone</span>
                            <span className={`transition-colors font-medium ${theme.textValue}`}>
                               {company.ddd_telefone_1 
                                 ? `${company.ddd_telefone_1} ${company.ddd_telefone_2 ? ' / ' + company.ddd_telefone_2 : ''}`
                                 : <span className={`italic text-xs ${theme.textLabel}`}>Não informado</span>}
                            </span>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#1e293b' : '#e2e8f0'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#334155' : '#cbd5e1'};
        }
      `}</style>
    </div>
  );
}
