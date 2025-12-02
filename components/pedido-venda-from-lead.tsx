"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Save, Search, Edit, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstoqueModal } from "@/components/estoque-modal"
import { ProdutoSelectorModal } from "@/components/produto-selector-modal"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { PedidoSyncService } from "@/lib/pedido-sync"


interface ItemPedido {
  CODPROD: string
  DESCRPROD?: string
  QTDNEG: number
  VLRUNIT: number
  PERCDESC: number
  CODLOCALORIG: string
  CONTROLE: string
  AD_QTDBARRA?: number
  CODVOL?: string
  IDALIQICMS?: string
  SEQUENCIA?: number // Adicionado para o ProdutoSelectorModal
}

interface PedidoVendaFromLeadProps {
  dadosIniciais: any
  onSuccess: () => void
  onCancel: () => void
  onSalvarPedido?: (salvarFn: () => Promise<boolean>) => void
  isLeadVinculado?: boolean // Se true, sincroniza com o lead. Se false, pedido independente
}

export default function PedidoVendaFromLead({
  dadosIniciais,
  onSuccess,
  onCancel,
  onSalvarPedido,
  isLeadVinculado = false // Padrão false para não tentar sincronizar com lead
}: PedidoVendaFromLeadProps) {
  const [loading, setLoading] = useState(false)
  const [parceiros, setParceiros] = useState<any[]>([])
  const [showProdutoModal, setShowProdutoModal] = useState(false)
  const [showEstoqueModal, setShowEstoqueModal] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null)
  const [showVendedorModal, setShowVendedorModal] = useState(false)
  const [dadosInicializados, setDadosInicializados] = useState(false)

  // Inicializar pedido e vendedor a partir dos dados iniciais - APENAS UMA VEZ
  useEffect(() => {
    if (dadosInicializados) return

    console.log('📦 Dados iniciais do pedido recebidos:', dadosIniciais)
    setPedido(dadosIniciais)
    setItens(dadosIniciais.itens || [])

    // Buscar nome do vendedor
    if (dadosIniciais.CODVEND && vendedores.length > 0) {
      const vendedor = vendedores.find(v => String(v.CODVEND) === String(dadosIniciais.CODVEND))
      if (vendedor) {
        setNomeVendedor(vendedor.NOMEVEND)
      }
    }

    setDadosInicializados(true)
  }, [])

  const [parceiroSearch, setParceiroSearch] = useState("")
  const [showParceirosDropdown, setShowParceirosDropdown] = useState(false)
  const [removendoItem, setRemovendoItem] = useState<number | null>(null)
  const [vendedores, setVendedores] = useState<any[]>([])
  const [tiposNegociacao, setTiposNegociacao] = useState<any[]>([])
  const [tiposOperacao, setTiposOperacao] = useState<any[]>([])
  const [condicaoComercialBloqueada, setCondicaoComercialBloqueada] = useState(false)
  const [condicaoComercialPorModelo, setCondicaoComercialPorModelo] = useState(false)
  const [tipoOperacaoBloqueado, setTipoOperacaoBloqueado] = useState(false)
  const [modeloNota, setModeloNota] = useState<string>("")
  const [tabelasPrecos, setTabelasPrecos] = useState<any[]>([]) // Estado para tabelas de preço

  // Estados adicionados para produto selecionado, estoque e preço
  const [produtoSelecionado, setProdutoSelecionado] = useState<any | null>(null)
  const [produtoEstoqueSelecionado, setProdutoEstoqueSelecionado] = useState<any | null>(null)
  const [produtoEstoque, setProdutoEstoque] = useState<number>(0)
  const [produtoPreco, setProdutoPreco] = useState<number>(0)
  const [tabelaSelecionada, setTabelaSelecionada] = useState<string>(""); // Estado para a tabela de preço selecionada
  const [isLoading, setIsLoading] = useState(false) // Estado de loading para busca de produto

  // Estados para Tipos de Pedido
  const [tiposPedido, setTiposPedido] = useState<any[]>([])
  const [tipoPedidoSelecionado, setTipoPedidoSelecionado] = useState<string>("")

  // Inicializar estado do pedido DIRETAMENTE no useState (SEM useMemo)
  const [pedido, setPedido] = useState(() => {
    console.log('🔧 Inicializando estado do pedido com dados:', dadosIniciais)

    const codParcLead = String(dadosIniciais.CODPARC || '').trim()
    const cpfCnpj = String(dadosIniciais.CPF_CNPJ || '').trim()
    const ieRg = String(dadosIniciais.IE_RG || '').trim()
    const razaoSocial = String(dadosIniciais.RAZAOSOCIAL || dadosIniciais.RAZAO_SOCIAL || '').trim()
    const tipoCliente = dadosIniciais.TIPO_CLIENTE || 'PJ'

    console.log('📋 Dados do parceiro para estado inicial:', {
      CODPARC: codParcLead,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      TIPO_CLIENTE: tipoCliente
    })

    return {
      CODEMP: dadosIniciais.CODEMP || "1",
      CODCENCUS: dadosIniciais.CODCENCUS || "0",
      NUNOTA: dadosIniciais.NUNOTA || "",
      DTNEG: new Date().toISOString().split('T')[0],
      DTFATUR: dadosIniciais.DTFATUR || "",
      DTENTSAI: dadosIniciais.DTENTSAI || "",
      CODPARC: codParcLead,
      CODTIPOPER: dadosIniciais.CODTIPOPER || "974",
      TIPMOV: dadosIniciais.TIPMOV || "P",
      CODTIPVENDA: dadosIniciais.CODTIPVENDA || "1",
      CODVEND: dadosIniciais.CODVEND || "0",
      OBSERVACAO: dadosIniciais.OBSERVACAO || "",
      VLOUTROS: dadosIniciais.VLOUTROS || 0,
      VLRDESCTOT: dadosIniciais.VLRDESCTOT || 0,
      VLRFRETE: dadosIniciais.VLRFRETE || 0,
      TIPFRETE: dadosIniciais.TIPFRETE || "S",
      ORDEMCARGA: dadosIniciais.ORDEMCARGA || "",
      CODPARCTRANSP: dadosIniciais.CODPARCTRANSP || "0",
      CODNAT: dadosIniciais.CODNAT || "0",
      TIPO_CLIENTE: tipoCliente,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      itens: [] as ItemPedido[]
    }
  })
  const [itens, setItens] = useState<ItemPedido[]>(() => {
    // Inicializar itens diretamente no useState
    if (dadosIniciais.itens && dadosIniciais.itens.length > 0) {
      return dadosIniciais.itens.map((item: any, index: number) => ({
        CODPROD: String(item.CODPROD),
        DESCRPROD: item.DESCRPROD || '',
        QTDNEG: Number(item.QTDNEG) || 1,
        VLRUNIT: Number(item.VLRUNIT) || 0,
        PERCDESC: Number(item.PERCDESC) || 0,
        CODLOCALORIG: item.CODLOCALORIG || "700",
        CONTROLE: item.CONTROLE || "007",
        AD_QTDBARRA: item.AD_QTDBARRA || 1,
        CODVOL: item.CODVOL || "UN",
        IDALIQICMS: item.IDALIQICMS || "0",
        SEQUENCIA: item.SEQUENCIA || index + 1
      }))
    }
    return []
  })

  // Atualizar valor total sempre que os itens mudarem
  useEffect(() => {
    const total = itens.reduce((acc, item) => {
      const vlrUnit = Number(item.VLRUNIT) || 0
      const qtd = Number(item.QTDNEG) || 0
      const percdesc = Number(item.PERCDESC) || 0
      const vlrDesc = (vlrUnit * qtd * percdesc) / 100
      const subtotal = vlrUnit * qtd - vlrDesc

      console.log('📊 Item:', {
        produto: item.DESCRPROD,
        vlrUnit,
        qtd,
        percdesc,
        vlrDesc,
        subtotal
      })

      return acc + subtotal
    }, 0)

    console.log('💰 Total calculado:', total)
    setPedido(prev => ({ ...prev, VLRNOTA: total }))
  }, [itens])

  // useEffect APENAS para inicialização da UI (campo de busca)
  useEffect(() => {
    console.log('🔄 Inicializando UI do componente')

    // Preencher campo de busca da UI (APENAS SE TEM CODPARC)
    const codParcLead = String(dadosIniciais.CODPARC || "").trim()
    const razaoSocialLead = dadosIniciais.RAZAOSOCIAL || dadosIniciais.RAZAO_SOCIAL || ""

    if (codParcLead !== "" && codParcLead !== "0") {
      setParceiroSearch(`${razaoSocialLead} (✓ Código: ${codParcLead})`)
    }

    // Garantir que a Condição Comercial não está bloqueada na inicialização
    setCondicaoComercialBloqueada(false)
    setCondicaoComercialPorModelo(false)
    setTipoOperacaoBloqueado(false)

  }, []) // Array vazio - executa APENAS UMA VEZ na montagem

  const [itemAtual, setItemAtual] = useState<ItemPedido>({
    CODPROD: "",
    QTDNEG: 1,
    VLRUNIT: 0,
    PERCDESC: 0,
    CODLOCALORIG: "700",
    CONTROLE: "007",
    AD_QTDBARRA: 1,
    CODVOL: "UN",
    IDALIQICMS: "0"
  })

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isAdminUser, setIsAdminUser] = useState(false) // Verificar se é administrador
  const [nomeVendedor, setNomeVendedor] = useState<string>('') // Estado para o nome do vendedor

  useEffect(() => {
    carregarDadosIniciais()
  }, [])

  const carregarDadosIniciais = async () => {
    setIsInitialLoading(true)
    try {
      // Carregar apenas vendedor do usuário inicialmente
      await carregarVendedorUsuario()

      // Carregar outros dados em background sem bloquear a UI
      Promise.all([
        carregarTiposNegociacao(),
        carregarTiposOperacao(),
        carregarTabelasPrecos(), // Chamada para carregar tabelas de preço
        carregarTiposPedido() // Carregar tipos de pedido
      ]).catch(error => {
        console.error('Erro ao carregar dados complementares:', error)
      })

      // Parceiros serão carregados sob demanda quando o usuário abrir o seletor
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error)
      toast.error('Erro ao carregar dados. Tente novamente.')
    } finally {
      setIsInitialLoading(false)
    }
  }

  const carregarTiposPedido = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tipos = await OfflineDataService.getTiposPedido()

      setTiposPedido(tipos)
      console.log('✅ Tipos de pedido carregados do IndexedDB:', tipos.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de pedido:', error)
      setTiposPedido([])
    }
  }

  const aplicarConfiguracoesTipoPedido = (tipoPedido: any) => {
    console.log('🔧 Aplicando configurações do tipo de pedido:', tipoPedido)

    setPedido(prev => ({
      ...prev,
      CODTIPOPER: String(tipoPedido.CODTIPOPER),
      TIPMOV: tipoPedido.TIPMOV,
      CODTIPVENDA: String(tipoPedido.CODTIPVENDA)
    }))

    setModeloNota(String(tipoPedido.MODELO_NOTA))
    setTipoOperacaoBloqueado(true)
    setCondicaoComercialBloqueada(true)
    setCondicaoComercialPorModelo(false)

    toast.success(`Tipo de pedido "${tipoPedido.NOME}" aplicado`, {
      description: 'Configurações carregadas automaticamente'
    })
  }

  const carregarVendedorUsuario = async () => {
    try {
      const userStr = document.cookie
        .split('; ')
        .find(row => row.startsWith('user='))
        ?.split('=')[1]

      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr))

        // Verificar se é administrador
        const isAdmin = user.role === 'Administrador' || user.role === 'Admin'
        setIsAdminUser(isAdmin)

        if (user.codVendedor) {
          setPedido(prev => ({ ...prev, CODVEND: String(user.codVendedor) }))
          console.log('✅ Vendedor automático:', user.codVendedor, '| Admin:', isAdmin)
        } else if (!isAdmin) {
          console.warn('⚠️ Usuário sem vendedor vinculado')
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendedor do usuário:', error)
    }
  }

  const carregarParceiros = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const parceirosList = await OfflineDataService.getParceiros()

      setParceiros(parceirosList)
      console.log('✅ Parceiros carregados do IndexedDB:', parceirosList.length)
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error)
      setParceiros([])
    }
  }

  const carregarVendedores = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const vendedoresList = await OfflineDataService.getVendedores()

      // Filtrar apenas vendedores ativos
      const vendedoresAtivos = vendedoresList.filter((v: any) =>
        v.ATIVO === 'S' && v.TIPVEND === 'V'
      )

      setVendedores(vendedoresAtivos)
      console.log('✅ Vendedores carregados do IndexedDB:', vendedoresAtivos.length)
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error)
      setVendedores([])
    }
  }

  const carregarTiposNegociacao = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tiposNegociacaoList = await OfflineDataService.getTiposNegociacao()

      setTiposNegociacao(tiposNegociacaoList)
      console.log('✅ Tipos de negociação carregados do IndexedDB:', tiposNegociacaoList.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de negociação:', error)
      setTiposNegociacao([])
    }
  }

  const carregarTiposOperacao = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const tiposOperacaoList = await OfflineDataService.getTiposOperacao()

      setTiposOperacao(tiposOperacaoList)
      console.log('✅ Tipos de operação carregados do IndexedDB:', tiposOperacaoList.length)
    } catch (error) {
      console.error('Erro ao carregar tipos de operação:', error)
      setTiposOperacao([])
    }
  }

  // Função atualizada para carregar tabelas de preço configuradas do IndexedDB
  const carregarTabelasPrecos = async () => {
    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const configs = await OfflineDataService.getTabelasPrecosConfig()

      // Converter formato de configuração para formato de tabela
      const tabelasFormatadas = configs.map((config: any) => ({
        NUTAB: config.NUTAB,
        CODTAB: config.CODTAB,
        DESCRICAO: config.DESCRICAO,
        ATIVO: config.ATIVO
      }))

      setTabelasPrecos(tabelasFormatadas)
      console.log('✅ Tabelas de preços configuradas carregadas do IndexedDB:', tabelasFormatadas.length)

      // Definir a primeira tabela como selecionada por padrão, se houver
      if (tabelasFormatadas.length > 0 && !tabelaSelecionada) {
        setTabelaSelecionada(String(tabelasFormatadas[0].NUTAB));
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tabelas de preços configuradas:', error)
      toast.error("Falha ao carregar tabelas de preços. Verifique as configurações.")
      setTabelasPrecos([])
    }
  }

  const _carregarTabelasPrecosLegacy = async () => {
    try {
      // Código antigo mantido para referência
      const cached = sessionStorage.getItem('cached_tabelasPrecos')
      if (cached) {
        try {
          const cachedData = JSON.parse(cached)
          const tabelas = Array.isArray(cachedData) ? cachedData : (cachedData.tabelas || [])
          setTabelasPrecos(tabelas)
          console.log('✅ Tabelas de preços carregadas do cache:', tabelas.length)

          if (tabelas.length > 0 && !tabelaSelecionada) {
            setTabelaSelecionada(String(tabelas[0].NUTAB));
          }
          return
        } catch (e) {
          console.warn('⚠️ Erro ao processar cache de tabelas de preços')
          sessionStorage.removeItem('cached_tabelasPrecos')
        }
      }

      const response = await fetch('/api/oracle/tabelas-precos')
      if (!response.ok) throw new Error('Erro ao carregar tabelas de preços')
      const data = await response.json()
      const tabelas = data.tabelas || []
      setTabelasPrecos(tabelas)

      if (tabelas.length > 0) {
        sessionStorage.setItem('cached_tabelasPrecos', JSON.stringify(tabelas))
      }

      // Definir a primeira tabela como selecionada por padrão, se houver
      if (tabelas.length > 0 && !tabelaSelecionada) {
        setTabelaSelecionada(String(tabelas[0].NUTAB));
      }
    } catch (error) {
      console.error('Erro ao carregar tabelas de preços:', error)
      toast.error("Falha ao carregar tabelas de preços. Verifique sua conexão.")
      setTabelasPrecos([]) // Garantir array vazio em caso de erro
    }
  }

  const [searchParceiroTimeout, setSearchParceiroTimeout] = useState<NodeJS.Timeout | null>(null)

  const buscarParceiros = async (search: string) => {
    // Só buscar se tiver 2+ caracteres
    if (search.length < 2) {
      setParceiros([])
      setShowParceirosDropdown(false)
      return
    }

    try {
      console.log('🔍 Buscando parceiros no IndexedDB para:', search)

      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      const allParceiros = await OfflineDataService.getParceiros({ search })

      console.log(`✅ ${allParceiros.length} parceiros filtrados do IndexedDB`)

      if (allParceiros.length > 0) {
        console.log('📋 Primeiros 3 parceiros filtrados:', allParceiros.slice(0, 3).map(p => ({
          CODPARC: p.CODPARC,
          NOMEPARC: p.NOMEPARC,
          CGC_CPF: p.CGC_CPF
        })))
      }

      setParceiros(allParceiros)
      setShowParceirosDropdown(allParceiros.length > 0)

    } catch (error) {
      console.error('❌ Erro ao buscar parceiros no IndexedDB:', error)
      setParceiros([])
      setShowParceirosDropdown(false)
    }
  }

  const handleParceiroSearchDebounced = (search: string) => {
    setParceiroSearch(search)

    // Limpar timeout anterior
    if (searchParceiroTimeout) {
      clearTimeout(searchParceiroTimeout)
    }

    // Se campo vazio ou menos de 2 caracteres, limpar parceiros e fechar dropdown
    if (search.length < 2) {
      setParceiros([])
      setShowParceirosDropdown(false)
      return
    }

    console.log('⌨️ Digitando busca de parceiro:', search)

    // Aguardar 300ms após parar de digitar (mais responsivo)
    setSearchParceiroTimeout(setTimeout(() => {
      buscarParceiros(search)
    }, 300))
  }


  const buscarDadosModeloNota = async (nunota: string) => {
    if (!nunota || nunota.trim() === '') {
      // Se limpar o modelo, desbloquear tipo de operação e condição comercial
      setTipoOperacaoBloqueado(false)
      if (!condicaoComercialBloqueada) {
        setCondicaoComercialPorModelo(false)
      }
      return;
    }

    try {
      console.log('🔍 Buscando dados do modelo NUNOTA:', nunota)
      const response = await fetch('/api/sankhya/tipos-negociacao?tipo=modelo&nunota=' + nunota)
      const data = await response.json()

      if (data.codTipOper) {
        console.log('✅ Dados do modelo encontrados:', data)

        // Atualizar APENAS os campos do modelo, preservando dados do parceiro
        setPedido(prev => {
          const novoEstado = {
            ...prev, // Preservar TODO o estado anterior
            CODTIPOPER: String(data.codTipOper)
          }

          // PRIORIDADE 1: Se tiver condição comercial do parceiro, NÃO atualiza
          if (!condicaoComercialBloqueada && data.codTipVenda) {
            novoEstado.CODTIPVENDA = String(data.codTipVenda)
          }

          console.log('🔄 Atualizando estado com dados do modelo (preservando parceiro):', {
            CODPARC: novoEstado.CODPARC,
            CPF_CNPJ: novoEstado.CPF_CNPJ,
            IE_RG: novoEstado.IE_RG,
            RAZAO_SOCIAL: novoEstado.RAZAOSOCIAL,
            CODTIPOPER: novoEstado.CODTIPOPER,
            CODTIPVENDA: novoEstado.CODTIPVENDA
          })

          return novoEstado
        })

        // Bloquear tipo de operação quando vier do modelo
        setTipoOperacaoBloqueado(true)

        // PRIORIDADE 2: Só marca como "por modelo" se NÃO tiver do parceiro
        if (!condicaoComercialBloqueada && data.codTipVenda && data.codTipVenda !== '0') {
          setCondicaoComercialPorModelo(true)
          toast.success('Tipo de operação definido pelo modelo')
        } else if (condicaoComercialBloqueada) {
          toast.info('Tipo de operação definido pelo modelo. Condição comercial mantida do parceiro.')
        } else {
          toast.success('Tipo de operação definido pelo modelo')
          setCondicaoComercialPorModelo(false)
        }
      } else {
        console.log('ℹ️ Nenhum dado encontrado para este NUNOTA')
        toast.warning('Modelo da nota não encontrado')
        setTipoOperacaoBloqueado(false)
        setCondicaoComercialPorModelo(false)
      }
    } catch (error) {
      console.error('Erro ao buscar dados do modelo da nota:', error)
      toast.error('Erro ao buscar dados do modelo')
      setTipoOperacaoBloqueado(false)
    }
  }

  const selecionarParceiro = async (parceiro: any) => {
    console.log('✅ Parceiro selecionado:', parceiro)

    const codParc = String(parceiro.CODPARC).trim()
    const nomeParc = parceiro.NOMEPARC || parceiro.RAZAOSOCIAL || ''
    const razaoSocial = parceiro.RAZAOSOCIAL || parceiro.NOMEPARC || ''

    // Validar dados essenciais antes de prosseguir
    if (!parceiro.CGC_CPF || !parceiro.CGC_CPF.trim()) {
      console.error('⚠️ Parceiro sem CPF/CNPJ:', parceiro)
      toast.error("Este parceiro não possui CPF/CNPJ cadastrado. Complete o cadastro antes de continuar.")
      return
    }

    if (!parceiro.IDENTINSCESTAD || !parceiro.IDENTINSCESTAD.trim()) {
      console.error('⚠️ Parceiro sem IE/RG:', parceiro)
      toast.error("Este parceiro não possui IE/RG cadastrado. Complete o cadastro antes de continuar.")
      return
    }

    // Fechar dropdown e limpar lista PRIMEIRO
    setShowParceirosDropdown(false)
    setParceiros([])

    // Preencher dados básicos do parceiro
    const tipPessoa = parceiro.TIPPESSOA === 'J' ? 'PJ' : 'PF'
    const dadosParceiro = {
      CODPARC: codParc,
      TIPO_CLIENTE: tipPessoa,
      CPF_CNPJ: parceiro.CGC_CPF,
      IE_RG: parceiro.IDENTINSCESTAD,
      RAZAO_SOCIAL: razaoSocial
    }

    // Atualizar estado do pedido
    setPedido(prev => {
      const novoEstado = {
        ...prev,
        ...dadosParceiro
      }
      console.log('🔄 Estado ANTERIOR do pedido:', prev)
      console.log('🔄 Estado NOVO do pedido:', novoEstado)
      return novoEstado
    })

    // Atualizar campo de busca com nome do parceiro
    setParceiroSearch(`${nomeParc} (✓ Código: ${codParc})`)

    console.log('✅ Dados do parceiro salvos no estado:', dadosParceiro)

    // Sincronizar com o lead quando tiver CODLEAD (independente de isLeadVinculado)
    if (dadosIniciais?.CODLEAD) {
      try {
        console.log('🔄 Atualizando parceiro do lead no banco:', {
          CODLEAD: dadosIniciais.CODLEAD,
          CODPARC: codParc,
          NOMEPARC: nomeParc
        })

        const response = await fetch('/api/leads/atualizar-parceiro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codLead: dadosIniciais.CODLEAD,
            codParc: codParc
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao atualizar parceiro do lead')
        }

        const result = await response.json()
        console.log('✅ Parceiro do lead atualizado com sucesso no Oracle:', result)

        toast.success(`Parceiro vinculado ao lead!`, {
          description: `${nomeParc} (Cód: ${codParc})`,
          duration: 3000
        })
      } catch (error: any) {
        console.error('❌ Erro ao sincronizar parceiro com o lead:', error)
        toast.error('Erro ao atualizar parceiro do lead', {
          description: error.message,
          duration: 5000
        })
      }
    } else {
      // Pedido sem vinculação com lead
      toast.success(`Parceiro selecionado: ${nomeParc}`, {
        description: `Código: ${codParc}`
      })
    }
  }

  const abrirModalNovoItem = () => {
    setItemAtual({
      CODPROD: "",
      QTDNEG: 1,
      VLRUNIT: 0,
      PERCDESC: 0,
      CODLOCALORIG: "700",
      CONTROLE: "007",
      AD_QTDBARRA: 1,
      CODVOL: "UN",
      IDALIQICMS: "0"
    })
    setCurrentItemIndex(null)
    // Abrir diretamente o modal de busca de produtos
    setShowProdutoModal(true)
  }

  const abrirModalEditarItem = async (index: number) => {
    const itemParaEditar = itens[index]
    setItemAtual({ ...itemParaEditar })
    setCurrentItemIndex(index)
    
    // Preparar dados do produto para o modal de estoque
    const produtoParaEditar = {
      CODPROD: itemParaEditar.CODPROD,
      DESCRPROD: itemParaEditar.DESCRPROD,
      MARCA: itemParaEditar.MARCA || '-',
      UNIDADE: itemParaEditar.CODVOL || 'MM'
    }
    
    setProdutoSelecionado(produtoParaEditar)
    setProdutoEstoqueSelecionado(produtoParaEditar)
    
    // Buscar estoque atual do IndexedDB
    setIsLoading(true)
    try {
      const { OfflineDataService } = await import('@/lib/offline-data-service')
      
      // Buscar estoque
      const estoques = await OfflineDataService.getEstoque(itemParaEditar.CODPROD)
      const estoqueTotal = estoques.reduce((sum: number, e: any) => sum + (parseFloat(e.ESTOQUE) || 0), 0)
      setProdutoEstoque(estoqueTotal)
      
      // USAR VALORES DO ITEM ATUAL (não buscar novamente)
      setProdutoPreco(itemParaEditar.VLRUNIT)
      
      console.log('✅ Editando item:', {
        produto: itemParaEditar.DESCRPROD,
        quantidade: itemParaEditar.QTDNEG,
        precoUnit: itemParaEditar.VLRUNIT,
        estoque: estoqueTotal
      })
      
      // Abrir modal de estoque diretamente
      setShowEstoqueModal(true)
    } catch (error) {
      console.error('❌ Erro ao carregar dados do produto:', error)
      setProdutoEstoque(0)
      setProdutoPreco(itemParaEditar.VLRUNIT)
      setShowEstoqueModal(true)
    } finally {
      setIsLoading(false)
    }
  }

  const removerItem = async (index: number) => {
    const itemParaRemover = itens[index]
    setRemovendoItem(index)

    // Sincronizar remoção com o lead (apenas se vinculado E houver CODLEAD)
    if (isLeadVinculado === true && dadosIniciais?.CODLEAD) {
      try {
        console.log('🔄 Buscando produto no lead para remover:', itemParaRemover.CODPROD)

        // Buscar produtos do lead para obter o CODITEM
        const responseProdutos = await fetch(`/api/leads/produtos?codLead=${dadosIniciais.CODLEAD}`)
        if (responseProdutos.ok) {
          const produtos = await responseProdutos.json()
          const produtoLead = produtos.find((p: any) => String(p.CODPROD) === String(itemParaRemover.CODPROD))

          if (produtoLead && produtoLead.CODITEM) {
            console.log('🔄 Removendo produto do lead:', produtoLead.CODITEM)
            const responseRemover = await fetch('/api/leads/produtos/remover', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codItem: produtoLead.CODITEM,
                codLead: dadosIniciais.CODLEAD
              })
            })

            if (responseRemover.ok) {
              const result = await responseRemover.json()
              console.log('✅ Produto removido do lead. Novo total:', result.novoValorTotal)

              await new Promise(resolve => setTimeout(resolve, 300))
              setItens(itens.filter((_, i) => i !== index))
              setPedido(prev => ({ ...prev, itens: itens.filter((_, i) => i !== index) }))
              setRemovendoItem(null)

              toast.success("Item removido!", {
                description: `Valor total do lead: R$ ${result.novoValorTotal.toFixed(2)}`
              })
              return
            } else {
              throw new Error('Erro ao remover produto do lead')
            }
          }
        }
      } catch (error: any) {
        console.error('❌ Erro ao sincronizar remoção:', error)
        toast.error('Erro ao remover produto do lead', {
          description: error.message
        })
        setRemovendoItem(null)
        return
      }
    }

    // Se não tem CODLEAD, apenas remove localmente
    await new Promise(resolve => setTimeout(resolve, 300))
    setItens(itens.filter((_, i) => i !== index))
    setPedido(prev => ({ ...prev, itens: itens.filter((_, i) => i !== index) }))
    setRemovendoItem(null)
    toast.success("Item removido")
  }

  const handleSelecionarProduto = async (produto: any) => {
    console.log('🔍 Selecionando produto:', produto.CODPROD)
    setProdutoSelecionado(produto)
    setIsLoading(true)

    try {
      // Buscar do IndexedDB
      const { OfflineDataService } = await import('@/lib/offline-data-service')

      let estoqueTotal = 0;
      let preco = produto.AD_VLRUNIT || 0;

      // Buscar estoque do IndexedDB
      const estoques = await OfflineDataService.getEstoque(produto.CODPROD);
      estoqueTotal = estoques.reduce((sum: number, e: any) => sum + (parseFloat(e.ESTOQUE) || 0), 0);
      console.log('📦 Estoque do IndexedDB:', estoqueTotal);

      // Buscar preço do IndexedDB
      if (tabelaSelecionada) {
        const precos = await OfflineDataService.getPrecos(produto.CODPROD, Number(tabelaSelecionada));
        if (precos.length > 0 && precos[0].VLRVENDA) {
          preco = parseFloat(precos[0].VLRVENDA);
          console.log('💰 Preço da exceção do IndexedDB:', preco);
        }
      }

      setProdutoEstoque(estoqueTotal)
      setProdutoPreco(preco)
      setShowEstoqueModal(true)

      console.log('✅ Usando dados do IndexedDB - Estoque:', estoqueTotal, 'Preço:', preco);

    } catch (error: any) {
      console.error('❌ Erro ao carregar dados do produto:', error)

      // Usar valores padrão
      console.warn('⚠️ Usando valores padrão')
      setProdutoEstoque(0)
      setProdutoPreco(produto.AD_VLRUNIT || 0)
      setShowEstoqueModal(true)
      toast.error('Usando valores padrão do produto')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmarProdutoEstoque = async (produto: any, preco: number, quantidade: number) => {
    // Fechar modais
    setShowEstoqueModal(false)
    setShowProdutoModal(false)

    if (currentItemIndex !== null) {
      // Editando item existente
      const itemExistente = itens[currentItemIndex]
      const novoItem: ItemPedido = {
        ...itemExistente, // Preserva todos os campos existentes
        QTDNEG: quantidade,
        VLRUNIT: preco
      }

      const novosItens = [...itens]
      novosItens[currentItemIndex] = novoItem
      setItens(novosItens)
      setPedido(prev => {
        const updatedItens = [...prev.itens]
        updatedItens[currentItemIndex] = novoItem
        return { ...prev, itens: updatedItens }
      })

      // Sincronizar edição com o lead SEMPRE quando tiver CODLEAD
      if (dadosIniciais?.CODLEAD) {
        try {
          console.log('🔄 Sincronizando edição com lead:', dadosIniciais.CODLEAD);

          const responseProdutos = await fetch(`/api/leads/produtos?codLead=${dadosIniciais.CODLEAD}`);

          if (!responseProdutos.ok) {
            throw new Error('Erro ao buscar produtos do lead');
          }

          const produtosLead = await responseProdutos.json();
          const produtoLead = produtosLead[currentItemIndex];

          if (produtoLead?.CODITEM) {
            console.log('🔄 Atualizando produto do lead - CODITEM:', produtoLead.CODITEM);

            const response = await fetch('/api/leads/produtos/atualizar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codItem: produtoLead.CODITEM,
                codLead: dadosIniciais.CODLEAD,
                quantidade: quantidade,
                vlrunit: preco
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Erro ao atualizar produto no lead');
            }

            const result = await response.json();
            console.log('✅ Lead atualizado. Novo total:', result.novoValorTotal);

            toast.success("Produto atualizado!", {
              description: `Valor do lead: R$ ${result.novoValorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            });
          } else {
            console.warn('⚠️ Produto não encontrado no lead');
            toast.success("Produto atualizado localmente!");
          }
        } catch (error: any) {
          console.error('❌ Erro ao sincronizar com lead:', error);
          toast.error('Produto atualizado localmente, mas erro ao sincronizar lead');
        }
      } else {
        toast.success("Produto atualizado!");
      }
    } else {
      // Adicionando novo item
      const novoItem: ItemPedido = {
        CODPROD: String(produto.CODPROD),
        DESCRPROD: produto.DESCRPROD,
        QTDNEG: quantidade,
        VLRUNIT: preco,
        PERCDESC: 0, // Resetar desconto ao adicionar novo item
        CODLOCALORIG: "700",
        CONTROLE: "007",
        AD_QTDBARRA: 1,
        CODVOL: "UN",
        IDALIQICMS: "0",
        SEQUENCIA: pedido.itens.length + 1
      }
      setItens([...itens, novoItem])
      setPedido(prev => ({ ...prev, itens: [...prev.itens, novoItem] }))

      // SEMPRE adicionar produto ao lead quando tiver CODLEAD (independente de isLeadVinculado)
      if (dadosIniciais?.CODLEAD) {
        try {
          const vlrTotal = preco * quantidade
          console.log('➕ Adicionando produto ao lead:', {
            CODLEAD: dadosIniciais.CODLEAD,
            CODPROD: produto.CODPROD,
            DESCRPROD: produto.DESCRPROD,
            QUANTIDADE: quantidade,
            VLRUNIT: preco,
            VLRTOTAL: vlrTotal
          });

          const response = await fetch('/api/leads/produtos/adicionar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              CODLEAD: dadosIniciais.CODLEAD,
              CODPROD: produto.CODPROD,
              DESCRPROD: produto.DESCRPROD,
              QUANTIDADE: quantidade,
              VLRUNIT: preco,
              VLRTOTAL: vlrTotal
            })
          })

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao adicionar produto ao lead');
          }

          const result = await response.json()
          console.log('✅ Produto adicionado ao lead. Novo total do lead:', result.novoValorTotal)
          
          toast.success("Produto adicionado!", {
            description: `Valor total do lead: R$ ${result.novoValorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            duration: 3000
          })
        } catch (error: any) {
          console.error('❌ Erro ao sincronizar produto com lead:', error)
          toast.error('Erro ao adicionar produto ao lead', {
            description: error.message || 'Tente novamente',
            duration: 5000
          })
          
          // Reverter adição local se falhar no banco
          setItens(itens)
          setPedido(prev => ({ ...prev, itens: itens }))
        }
      } else {
        toast.success("Item adicionado")
      }
    }

    setCurrentItemIndex(null)
  }

  const abrirModalEstoque = (produto: any) => {
    setProdutoEstoqueSelecionado(produto)
    setShowEstoqueModal(true)
  }

  const calcularTotal = (item: ItemPedido) => {
    const total = item.QTDNEG * item.VLRUNIT
    const desconto = total * (item.PERCDESC / 100)
    return total - desconto
  }

  const calcularTotalPedido = () => {
    return itens.reduce((acc, item) => acc + calcularTotal(item), 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const onClose = async () => {
    // Se tem CODLEAD e está vinculado a lead, recarregar dados antes de fechar
    if (isLeadVinculado && dadosIniciais.CODLEAD) {
      try {
        console.log('🔄 Recarregando dados do lead antes de fechar modal...')
        if (onSuccess) {
          await onSuccess()
        }
      } catch (error) {
        console.error('❌ Erro ao recarregar dados do lead:', error)
      }
    }
    onCancel()
  }

  const salvarPedido = useCallback(async (): Promise<boolean> => {
    console.log('🔍 Iniciando validação do pedido...')

    // Validar tipo de pedido selecionado
    if (!tipoPedidoSelecionado) {
      console.error('❌ Validação falhou: Tipo de Pedido não selecionado')
      toast.error("Tipo de Pedido é obrigatório", {
        description: "Selecione um tipo de pedido antes de salvar."
      })
      return false
    }

    // Usar valores atuais dos estados diretamente (useCallback garante que serão os mais recentes)
    const dadosAtuaisPedido = { ...pedido }

    console.log('📋 Dados capturados da tela:', {
      CODPARC: dadosAtuaisPedido.CODPARC,
      CPF_CNPJ: dadosAtuaisPedido.CPF_CNPJ,
      IE_RG: dadosAtuaisPedido.IE_RG,
      RAZAO_SOCIAL: dadosAtuaisPedido.RAZAOSOCIAL,
      CODVEND: dadosAtuaisPedido.CODVEND,
      CODTIPOPER: dadosAtuaisPedido.CODTIPOPER,
      CODTIPVENDA: dadosAtuaisPedido.CODTIPVENDA,
      DTNEG: dadosAtuaisPedido.DTNEG,
      TIPO_PEDIDO: tipoPedidoSelecionado
    })

    // Validar dados diretamente dos dados capturados
    const codParc = String(dadosAtuaisPedido.CODPARC || '').trim()
    const cpfCnpj = String(dadosAtuaisPedido.CPF_CNPJ || '').trim()
    const ieRg = String(dadosAtuaisPedido.IE_RG || '').trim()
    // Buscar RAZAO_SOCIAL de ambas as possíveis propriedades
    const razaoSocial = String(dadosAtuaisPedido.RAZAO_SOCIAL || dadosAtuaisPedido.RAZAOSOCIAL || '').trim()

    console.log('📋 Dados extraídos para validação:', {
      CODPARC: codParc,
      CPF_CNPJ: cpfCnpj,
      IE_RG: ieRg,
      RAZAO_SOCIAL: razaoSocial,
      RAZAO_SOCIAL_original: dadosAtuaisPedido.RAZAO_SOCIAL,
      RAZAOSOCIAL_original: dadosAtuaisPedido.RAZAOSOCIAL
    })

    console.log('🔍 Verificando se dados do parceiro estão presentes:', {
      temCODPARC: !!codParc && codParc !== '0',
      temCPF_CNPJ: !!cpfCnpj,
      temIE_RG: !!ieRg,
      temRAZAO_SOCIAL: !!razaoSocial
    })

    console.log('\n🔍 DEBUG - Valores do modelo da nota:')
    console.log(`   - Estado modeloNota: "${modeloNota}"`)

    const modeloNotaTrimmed = String(modeloNota).trim()

    // Validar que modelo da nota foi preenchido
    if (!modeloNotaTrimmed || modeloNotaTrimmed === '' || modeloNotaTrimmed === '0') {
      console.error('❌ Validação falhou: Modelo da Nota vazio ou inválido')
      toast.error("Modelo da Nota é obrigatório", {
        description: "Preencha o número do modelo da nota antes de salvar."
      })
      return false
    }

    const modeloNotaNumero = Number(modeloNotaTrimmed)

    if (isNaN(modeloNotaNumero) || modeloNotaNumero <= 0) {
      console.error('❌ Validação falhou: Modelo da Nota com valor inválido:', modeloNotaTrimmed)
      toast.error("Modelo da Nota inválido", {
        description: "Informe um número válido para o modelo da nota."
      })
      return false
    }

    console.log(`✅ Modelo da Nota validado com sucesso: ${modeloNotaNumero}`)

    // Validar CODPARC
    if (!codParc || codParc === '0') {
      console.error('❌ Validação falhou: CODPARC inválido ou vazio')
      toast.error("Parceiro não selecionado", {
        description: "Selecione um parceiro válido antes de salvar."
      })
      return false
    }

    // Validar CPF/CNPJ
    if (!cpfCnpj) {
      console.error('❌ Validação falhou: CPF/CNPJ vazio')
      toast.error("CPF/CNPJ não encontrado", {
        description: "Preencha o CPF/CNPJ do parceiro."
      })
      return false
    }

    // Validar IE/RG
    if (!ieRg) {
      console.error('❌ Validação falhou: IE/RG vazio')
      toast.error("IE/RG não encontrado", {
        description: "Preencha a IE/RG do parceiro."
      })
      return false
    }

    // Validar Razão Social
    if (!razaoSocial) {
      console.error('❌ Validação falhou: Razão Social vazia')
      toast.error("Razão Social não encontrada", {
        description: "Preencha a Razão Social do parceiro."
      })
      return false
    }

    // Validar vendedor (usando dados capturados)
    if (!dadosAtuaisPedido.CODVEND || dadosAtuaisPedido.CODVEND === "0") {
      toast.error("Vendedor não vinculado. Entre em contato com o administrador.")
      return false
    }

    // Itens do pedido - usar itens do estado local
    const itensParaEnviar = itens.length > 0 ? itens : []

    if (itensParaEnviar.length === 0) {
      console.log('❌ Validação de itens falhou')
      toast.error("Adicione pelo menos um item ao pedido")
      return false
    }

    setLoading(true)

    try {
      console.log('📦 Criando pedido de venda...')
      console.log('📋 Dados CAPTURADOS DA TELA para envio:', {
        CODPARC: codParc,
        CPF_CNPJ: cpfCnpj,
        IE_RG: ieRg,
        RAZAO_SOCIAL: razaoSocial,
        CODVEND: dadosAtuaisPedido.CODVEND,
        CODTIPOPER: dadosAtuaisPedido.CODTIPOPER,
        CODTIPVENDA: dadosAtuaisPedido.CODTIPVENDA,
        DTNEG: dadosAtuaisPedido.DTNEG,
        MODELO_NOTA: modeloNotaNumero,
        itensCount: itensParaEnviar.length
      })

      // Montar payload com dados CAPTURADOS DA TELA
      const pedidoCompleto = {
        CODEMP: dadosAtuaisPedido.CODEMP,
        CODCENCUS: dadosAtuaisPedido.CODCENCUS,
        NUNOTA: dadosAtuaisPedido.NUNOTA,
        DTNEG: dadosAtuaisPedido.DTNEG,
        DTFATUR: dadosAtuaisPedido.DTFATUR,
        DTENTSAI: dadosAtuaisPedido.DTENTSAI,
        CODPARC: codParc,
        CODTIPOPER: dadosAtuaisPedido.CODTIPOPER,
        TIPMOV: dadosAtuaisPedido.TIPMOV,
        CODTIPVENDA: dadosAtuaisPedido.CODTIPVENDA,
        CODVEND: dadosAtuaisPedido.CODVEND,
        OBSERVACAO: dadosAtuaisPedido.OBSERVACAO,
        VLOUTROS: dadosAtuaisPedido.VLOUTROS,
        VLRDESCTOT: dadosAtuaisPedido.VLRDESCTOT,
        VLRFRETE: dadosAtuaisPedido.VLRFRETE,
        TIPFRETE: dadosAtuaisPedido.TIPFRETE,
        ORDEMCARGA: dadosAtuaisPedido.ORDEMCARGA,
        CODPARCTRANSP: dadosAtuaisPedido.CODPARCTRANSP,
        CODNAT: dadosAtuaisPedido.CODNAT,
        TIPO_CLIENTE: dadosAtuaisPedido.TIPO_CLIENTE,
        CPF_CNPJ: cpfCnpj,
        IE_RG: ieRg,
        RAZAO_SOCIAL: razaoSocial,
        RAZAOSOCIAL: razaoSocial, // Enviar ambas as propriedades para compatibilidade
        MODELO_NOTA: modeloNotaNumero,
        itens: itensParaEnviar.map(item => ({
          CODPROD: item.CODPROD,
          QTDNEG: item.QTDNEG,
          VLRUNIT: item.VLRUNIT,
          PERCDESC: item.PERCDESC,
          CODLOCALORIG: item.CODLOCALORIG,
          CONTROLE: item.CONTROLE,
          AD_QTDBARRA: item.AD_QTDBARRA,
          CODVOL: item.CODVOL,
          IDALIQICMS: item.IDALIQICMS
        }))
      }

      console.log('📦 Dados completos sendo enviados para API:', pedidoCompleto)

      // Usar serviço de sincronização híbrida
      const result = await PedidoSyncService.salvarPedido(pedidoCompleto)

      if (!result.success) {
        throw new Error("Erro ao salvar pedido")
      }

      console.log('✅ Pedido criado:', result.data)

      // Atualizar lead para GANHO apenas se estiver vinculado
      console.log('🔍 Verificando vinculação do lead:', {
        isLeadVinculado,
        temCODLEAD: !!dadosIniciais?.CODLEAD,
        CODLEAD: dadosIniciais?.CODLEAD
      })
      
      if (isLeadVinculado === true && dadosIniciais?.CODLEAD) {
        console.log('🔄 Atualizando lead para status GANHO...')
        console.log('📋 CODLEAD do lead:', dadosIniciais.CODLEAD)

        try {
          const responseStatus = await fetch('/api/leads/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              codLead: String(dadosIniciais.CODLEAD),
              status: 'GANHO'
            })
          })

          const statusResult = await responseStatus.json()

          if (!responseStatus.ok) {
            console.error('❌ Erro ao atualizar status do lead:', statusResult)
            throw new Error(statusResult.error || 'Erro ao atualizar status do lead')
          }

          console.log('✅ Lead atualizado para GANHO no Oracle:', statusResult)

          toast.success("Pedido criado com sucesso!", {
            description: `Lead marcado como GANHO. Pedido: ${result.data.nunota}`,
            duration: 3000
          })

          await new Promise(resolve => setTimeout(resolve, 500))

          console.log('🔄 Chamando onSuccess para atualizar kanban...')
          if (onSuccess) {
            await onSuccess()
          }

          console.log('✅ onSuccess executado com sucesso')

        } catch (syncError: any) {
          console.error('❌ Erro ao sincronizar lead:', syncError)
          console.error('❌ Stack trace:', syncError.stack)
          toast.error('Erro ao atualizar lead', {
            description: syncError.message || 'O pedido foi criado mas houve erro ao atualizar o lead',
            duration: 5000
          })
          throw syncError
        }
      } else {
        // Pedido independente (sem lead vinculado)
        console.log('✅ Pedido rápido criado (sem vinculação com lead)')

        toast.success("Pedido criado com sucesso!", {
          description: `Pedido: ${result.data.nunota}`,
          duration: 2000
        })

        // Pequena pausa para o usuário ver a mensagem
        await new Promise(resolve => setTimeout(resolve, 300))

        // Chamar onSuccess se existir (para fechar o modal)
        if (onSuccess) {
          await onSuccess()
        }
      }

      return true
    } catch (error: any) {
      console.error('❌ Erro ao criar pedido:', error)
      toast.error(`Erro ao criar pedido: ${error.message || 'Erro desconhecido'}`, {
        duration: 8000,
        description: 'Verifique os dados e tente novamente. O lead não foi marcado como ganho.'
      })
      return false
    } finally {
      setLoading(false)
    }
  }, [
    modeloNota,
    pedido,
    itens,
    dadosIniciais,
    onSuccess,
    setLoading,
    tipoPedidoSelecionado
  ])

  // Passar a função salvarPedido para o componente pai quando disponível
  useEffect(() => {
    if (onSalvarPedido) {
      onSalvarPedido(salvarPedido)
    }
  }, [onSalvarPedido, salvarPedido])

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Seletor de Tipo de Pedido */}
      <Card className="border-green-200">
        <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-green-800">Tipo de Pedido *</Label>
            <Select
              value={tipoPedidoSelecionado}
              onValueChange={(value) => {
                setTipoPedidoSelecionado(value)
                const tipo = tiposPedido.find(t => String(t.CODTIPOPEDIDO) === value)
                if (tipo) {
                  aplicarConfiguracoesTipoPedido(tipo)
                }
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione o tipo de pedido..." />
              </SelectTrigger>
              <SelectContent>
                {tiposPedido.map((tipo) => (
                  <SelectItem key={tipo.CODTIPOPEDIDO} value={String(tipo.CODTIPOPEDIDO)}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tipo.COR || '#3b82f6' }}
                      />
                      <span>{tipo.NOME}</span>
                      {tipo.DESCRICAO && (
                        <span className="text-xs text-muted-foreground">- {tipo.DESCRICAO}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["parceiro", "nota", "itens"]} className="space-y-3">
        {/* Dados do Parceiro */}
        <AccordionItem value="parceiro" className="border rounded-lg bg-white">
          <AccordionTrigger className="px-3 md:px-4 py-2 md:py-3 hover:no-underline bg-gradient-to-r from-green-50 to-green-100 rounded-t-lg [&[data-state=closed]]:rounded-b-lg">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-green-600 rounded"></div>
              <span className="text-sm md:text-base font-semibold text-green-800">Dados do Parceiro</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              <div className="space-y-1 md:space-y-2 md:col-span-2">
                <Label className="text-xs">
                  Parceiro *
                  {pedido.CODPARC && pedido.CODPARC !== "0" && (
                    <span className="ml-2 text-[10px] text-green-600 font-semibold">
                      (✓ Selecionado - Código: {pedido.CODPARC})
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    value={parceiroSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      handleParceiroSearchDebounced(value)
                      // O estado do pedido (CODPARC, CPF_CNPJ, etc.) só deve ser
                      // alterado pela função 'selecionarParceiro' ou pelo 'useEffect'
                    }}
                    onFocus={() => {
                      if (parceiroSearch.length >= 2 && parceiros.length > 0) {
                        setShowParceirosDropdown(true)
                      }
                    }}
                    onBlur={() => {
                      // Aguardar um pouco antes de fechar para permitir o clique
                      setTimeout(() => setShowParceirosDropdown(false), 200)
                    }}
                    placeholder={pedido.CODPARC && pedido.CODPARC !== "0" ? "Parceiro selecionado - clique para alterar" : "Digite o nome do parceiro (min. 2 caracteres)..."}
                    className={`text-sm ${pedido.CODPARC && pedido.CODPARC !== "0" ? 'border-green-500 bg-green-50 font-medium' : ''}`}
                  />

                  {/* Dropdown de parceiros */}
                  {showParceirosDropdown && parceiros.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {parceiros.map((parceiro: any) => (
                        <div
                          key={parceiro.CODPARC}
                          onClick={() => selecionarParceiro(parceiro)}
                          className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                          <div className="font-medium">{parceiro.NOMEPARC || parceiro.RAZAOSOCIAL}</div>
                          <div className="text-xs text-gray-500">
                            Código: {parceiro.CODPARC} | {parceiro.CGC_CPF}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">Tipo Cliente *</Label>
                <Select value={pedido.TIPO_CLIENTE} onValueChange={(value) => setPedido({ ...pedido, TIPO_CLIENTE: value })}>
                  <SelectTrigger className="text-xs md:text-sm h-8 md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">CPF/CNPJ *</Label>
                <Input
                  value={pedido.CPF_CNPJ || ''}
                  onChange={(e) => {
                    const valor = e.target.value
                    setPedido(prev => ({ ...prev, CPF_CNPJ: valor }))
                    console.log('📝 CPF/CNPJ atualizado:', valor)
                  }}
                  placeholder="Digite o CPF/CNPJ"
                  className="text-xs md:text-sm h-8 md:h-10"
                />
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">IE/RG *</Label>
                <Input
                  value={pedido.IE_RG || ''}
                  onChange={(e) => {
                    const valor = e.target.value
                    setPedido(prev => ({ ...prev, IE_RG: valor }))
                    console.log('📝 IE/RG atualizado:', valor)
                  }}
                  placeholder="Digite a IE/RG"
                  className="text-xs md:text-sm h-8 md:h-10"
                />
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">Razão Social *</Label>
                <Input
                  value={pedido.RAZAO_SOCIAL || ''}
                  onChange={(e) => {
                    const valor = e.target.value
                    setPedido(prev => ({ ...prev, RAZAO_SOCIAL: valor }))
                    console.log('📝 Razão Social atualizada:', valor)
                  }}
                  placeholder="Digite a Razão Social"
                  className="text-xs md:text-sm h-8 md:h-10"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Dados da Nota */}
        <AccordionItem value="nota" className="border rounded-lg bg-white">
          <AccordionTrigger className="px-3 md:px-4 py-2 md:py-3 hover:no-underline bg-gradient-to-r from-green-50 to-green-100 rounded-t-lg [&[data-state=closed]]:rounded-b-lg">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-green-600 rounded"></div>
              <span className="text-sm md:text-base font-semibold text-green-800">Dados da Nota</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 md:px-4 pb-3 md:pb-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">Data Negociação *</Label>
                <Input
                  type="date"
                  value={pedido.DTNEG}
                  onChange={(e) => setPedido({ ...pedido, DTNEG: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  className="text-xs md:text-sm h-8 md:h-10"
                />
              </div>

              <div className="space-y-1 md:space-y-2">
                <Label className="text-xs">
                  Vendedor *
                  {!isAdminUser && pedido.CODVEND !== "0" && (
                    <span className="ml-2 text-[10px] text-orange-600 font-semibold">(🔒 Automático)</span>
                  )}
                  {isAdminUser && (
                    <span className="ml-2 text-[10px] text-green-600 font-semibold">(✅ Editável)</span>
                  )}
                </Label>
                <div className="flex gap-1">
                  <Input
                    value={pedido.CODVEND}
                    readOnly
                    placeholder={!isAdminUser ? "Vendedor vinculado ao usuário" : "Código do Vendedor"}
                    className={`text-xs md:text-sm h-8 md:h-10 ${!isAdminUser ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'}`}
                  />
                  {isAdminUser && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        await carregarVendedores()
                        setShowVendedorModal(true)
                      }}
                      className="h-8 w-8 md:h-10 md:w-10"
                    >
                      <Search className="w-3 h-3 md:w-4 md:h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mensagem de configuração automática */}
              {tipoPedidoSelecionado && (
                <div className="space-y-1 md:space-y-2 md:col-span-2">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">Configuração automática:</span> Os campos Tipo de Operação, Modelo da Nota, Tipo de Movimento e Condição Comercial foram configurados automaticamente pelo Tipo de Pedido selecionado.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-1 md:space-y-2 md:col-span-2">
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={pedido.OBSERVACAO}
                  onChange={(e) => setPedido({ ...pedido, OBSERVACAO: e.target.value })}
                  className="text-xs md:text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Itens do Pedido */}
        <AccordionItem value="itens" className="border rounded-lg bg-white">
          <AccordionTrigger className="px-3 md:px-4 py-2 md:py-3 hover:no-underline bg-gradient-to-r from-green-50 to-green-100 rounded-t-lg [&[data-state=closed]]:rounded-b-lg">
            <div className="flex items-center justify-between w-full pr-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-green-600 rounded"></div>
                <span className="text-sm md:text-base font-semibold text-green-800">
                  Itens do Pedido
                  {itens.length > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded-full">
                      {itens.length}
                    </span>
                  )}
                </span>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  abrirModalNovoItem()
                }}
                size="sm"
                className="bg-green-600 hover:bg-green-700 h-7 md:h-8 text-[10px] md:text-xs px-2 md:px-3"
              >
                <Plus className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Adicionar</span>
                <span className="sm:hidden">+</span>
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2 md:px-4 pb-3 md:pb-4 pt-3">
            {itens.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                Nenhum item adicionado
              </div>
            ) : (
              <div className="overflow-x-auto -mx-2 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] md:text-xs px-1 md:px-4">#</TableHead>
                      <TableHead className="text-[10px] md:text-xs px-1 md:px-4">Produto</TableHead>
                      <TableHead className="text-right text-[10px] md:text-xs px-1 md:px-4">Qtd</TableHead>
                      <TableHead className="text-right text-[10px] md:text-xs px-1 md:px-4 hidden sm:table-cell">Vlr. Unit.</TableHead>
                      <TableHead className="text-right text-[10px] md:text-xs px-1 md:px-4">Total</TableHead>
                      <TableHead className="text-[10px] md:text-xs px-1 md:px-4">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-4">{item.SEQUENCIA}</TableCell>
                        <TableCell className="text-[10px] md:text-xs px-1 md:px-4">
                          <div className="font-medium">{item.DESCRPROD}</div>
                          <div className="text-[8px] md:text-[10px] text-muted-foreground">Cód: {item.CODPROD}</div>
                        </TableCell>
                        <TableCell className="text-right text-[10px] md:text-xs px-1 md:px-4">{item.QTDNEG}</TableCell>
                        <TableCell className="text-right text-[10px] md:text-xs px-1 md:px-4 hidden sm:table-cell">{formatCurrency(item.VLRUNIT)}</TableCell>
                        <TableCell className="text-right text-[10px] md:text-xs px-1 md:px-4 font-medium text-green-700">
                          {formatCurrency(calcularTotal(item))}
                        </TableCell>
                        <TableCell className="px-1 md:px-4">
                          <div className="flex gap-0.5 md:gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirModalEditarItem(index)}
                              className="h-6 w-6 md:h-7 md:w-7"
                              disabled={removendoItem === index}
                            >
                              <Edit className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerItem(index)}
                              className="h-6 w-6 md:h-7 md:w-7 text-red-600"
                              disabled={removendoItem === index}
                            >
                              {removendoItem === index ? (
                                <div className="w-2.5 h-2.5 md:w-3 md:h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Total do Pedido */}
      <Card className="border-green-200">
        <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
          <div className="flex justify-between items-center p-2 md:p-3 bg-green-50 rounded-lg">
            <span className="font-bold text-xs md:text-sm">Total do Pedido:</span>
            <span className="text-base md:text-lg font-bold text-green-700">{formatCurrency(calcularTotalPedido())}</span>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Busca de Produto */}
      <ProdutoSelectorModal
        isOpen={showProdutoModal}
        onClose={() => setShowProdutoModal(false)}
        onConfirm={handleConfirmarProdutoEstoque}
        titulo="Buscar Produto"
      />

      {/* Modal de Estoque */}
      <EstoqueModal
        isOpen={showEstoqueModal}
        onClose={() => {
          setShowEstoqueModal(false)
          setCurrentItemIndex(null)
        }}
        product={produtoEstoqueSelecionado}
        estoqueTotal={produtoEstoque}
        preco={produtoPreco}
        quantidadeInicial={currentItemIndex !== null ? itens[currentItemIndex]?.QTDNEG : 1}
        onConfirm={handleConfirmarProdutoEstoque}
      />

      {/* Modal de Seleção de Vendedor */}
      <Dialog open={showVendedorModal} onOpenChange={setShowVendedorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Selecionar Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-96 overflow-y-auto space-y-2">
              {vendedores.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Nenhum vendedor encontrado
                </div>
              ) : (
                vendedores.map((vendedor) => (
                  <Card
                    key={vendedor.CODVEND}
                    className="cursor-pointer hover:bg-green-50 transition-colors"
                    onClick={() => {
                      setPedido({ ...pedido, CODVEND: String(vendedor.CODVEND) })
                      setShowVendedorModal(false)
                      toast.success(`Vendedor ${vendedor.APELIDO} selecionado`)
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{vendedor.APELIDO}</p>
                          <p className="text-xs text-muted-foreground">Cód: {vendedor.CODVEND}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}