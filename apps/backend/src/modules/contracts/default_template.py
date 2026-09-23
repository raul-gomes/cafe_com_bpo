"""Modelo padrão de contrato seedado para todo usuário novo.

Transcrição do documento
`docs/CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BPO FINANCEIRO.docx.pdf`.
Cada cláusula vira uma seção; os campos variáveis entre colchetes do
documento original foram convertidos em tokens `{{...}}`.

Tokens resolvidos na geração do contrato:
- CONTRATADA (dados da empresa do usuário, do perfil): `{{empresa_contratada}}`,
  `{{cnpj_contratada}}`, `{{endereco_contratada}}`, `{{socio_contratada}}`,
  `{{email_contratada}}`.
- CONTRATANTE (dados do prospecto): `{{nome}}`, `{{cnpj}}`, `{{endereco}}`,
  `{{cidade}}`, entre outros já suportados.
- Orçamento vinculado: `{{valor_mensal}}`, `{{valor_mensal_extenso}}`.

Tokens sem fonte de dados (ex.: `{{cpf_contratada}}`, `{{municipio_contratada}}`)
permanecem como estão no rascunho gerado, aguardando preenchimento manual antes
da finalização. `{{dia}}`, `{{mes}}` e `{{ano}}` são preenchidos com a data atual
(fuso de Brasília) na geração e na visualização.
"""

DEFAULT_TEMPLATE_SECTIONS: list[dict[str, str]] = [
    {
        "title": "CONTRATADA E CONTRATANTE",
        "content": (
            "CONTRATADA: Empresa {{empresa_contratada}}, inscrita no Cadastro Nacional "
            "de Pessoa Jurídica (CNPJ) sob nº. {{cnpj_contratada}}, localizada na "
            "{{endereco_contratada}}, representada neste ato pelo sócio(a) "
            "administrador(a) {{socio_contratada}}, portador do CPF n°. {{cpf_contratada}}.\n\n"
            "CONTRATANTE: Empresa {{nome}}, inscrita no Cadastro Nacional de Pessoa "
            "Jurídica (CNPJ) nº. {{cnpj}}, estabelecida na {{endereco}}, neste ato "
            "representado pelo sócio(a) administrador(a) {{socio_contratante}}, "
            "portador do CPF nº. {{cpf_contratante}}.\n\n"
            "Pelo presente instrumento particular de prestação de serviços, estabelecem "
            "as partes, de comum acordo, as seguintes disposições:"
        ),
    },
    {
        "title": "CLÁUSULA PRIMEIRA - DO OBJETO DO CONTRATO",
        "content": (
            "1.1. O objeto do presente Contrato consiste na prestação pela CONTRATADA à "
            "CONTRATANTE dos serviços de apoio nas rotinas financeiras, ao que tange em "
            "alimentar os registros das informações financeiras, recebida pela "
            "CONTRATANTE, no sistema de gestão financeira Controlle, que a permitirá "
            "estruturar os seguintes itens:\n\n"
            "1.1.1. Implantação e Treinamento - 1 (uma) reunião/call com duração de 2 "
            "(duas) horas com o consultor responsável pela implantação;\n\n"
            "1.1.2. Controle de contas pagar e a receber;\n\n"
            "1.1.3. Conciliação bancária;\n\n"
            "1.1.4. Emissão/envio de nota fiscal de serviço eletrônica (NFS-e);\n\n"
            "1.1.5. Emissão/envio de boletos;\n\n"
            "1.1.6. Controle de cartão de crédito a pagar;\n\n"
            "1.1.7. Acompanhamento de métricas e resultados operacionais;\n\n"
            "1.1.8. Relatórios Gerenciais;\n\n"
            "1.2. A disponibilização dos relatórios e funcionalidades será definida de "
            "acordo com o plano contratado do sistema de gestão e previamente acordado "
            "para atender às necessidades da CONTRATANTE."
        ),
    },
    {
        "title": "CLÁUSULA SEGUNDA - DAS CONDIÇÕES E DA EXECUÇÃO DOS SERVIÇOS",
        "content": (
            "2.1. A CONTRATADA executará os registros financeiros da CONTRATANTE no "
            "sistema Controlle, não tendo a obrigação de registrar as informações "
            "recebidas após o prazo de 5 dias da data de ocorrência.\n\n"
            "2.2. Os serviços serão executados nas dependências da CONTRATADA, "
            "respeitando o seguinte horário de atendimento: de segunda a sexta, das "
            "09:00 horas às 18:00 horas (horário de Brasília). A CONTRATADA reserva-se "
            "de prestar serviços de atendimento nos feriados nacionais e no feriado do "
            "município de {{municipio_contratada}}.\n\n"
            "2.3. A CONTRATADA limita-se nas informações repassadas pela CONTRATANTE "
            "para registrar as operações financeiras e auxiliará a CONTRATANTE a fazer "
            "as leituras e interpretações dos seus resultados financeiros.\n\n"
            "2.4. A documentação indispensável para o desempenho dos serviços arrolados "
            "na Cláusula Primeira será fornecida e enviada pela CONTRATANTE, consistindo "
            "basicamente em:\n\n"
            "2.4.1. Informações Bancárias - agência, conta e senha de consulta ao "
            "Internet banking, que serão utilizadas pela CONTRATADA para acessar o "
            "internet banking (site do banco) e extrair o extrato bancário, o arquivo "
            "OFX, demais informações e comprovantes que possibilita a CONTRATADA fazer "
            "as devidas conferências das movimentações de entradas e saídas dos valores "
            "bancários da CONTRATANTE.\n\n"
            "2.4.2. Número do estabelecimento e senha de acesso ao Portal das Vendas com "
            "Cartão. O registro dos recebimentos das vendas via Cartão (débito/crédito) "
            "contempla a conciliação das vendas diretamente em uma categoria de receita "
            "conforme entrada no banco. Com essas informações vamos acessar o portal da "
            "operadora de cartão para entender como funciona os recebimentos dos valores "
            "das vendas com cartão.\n\n"
            "2.4.3. Os documentos relativos às transações financeiras, tais como "
            "boletos, faturas, recibos, notas fiscais de compra, de venda e de serviços, "
            "comprovantes de depósitos, cópias de cheques, borderôs de cobrança, "
            "contratos, avisos de crédito, avisos de débitos, descontos de títulos, e "
            "demais recebimentos e pagamentos.\n\n"
            "2.5. A documentação deverá ser enviada semanalmente, na medida em que os "
            "fatos forem ocorrendo, pela CONTRATANTE de forma completa e em boa ordem "
            "através dos canais de comunicações disponibilizados pela CONTRATADA "
            "(e-mail, grupo do Whatsapp e pasta no Google Drive).\n\n"
            "2.6. A CONTRATADA possui prazo de 24 (vinte e quatro) horas (hora "
            "comercial) para atender às solicitações da CONTRATANTE e deixar o sistema "
            "atualizado."
        ),
    },
    {
        "title": "CLÁUSULA TERCEIRA - DOS DEVERES DA CONTRATADA",
        "content": (
            "3.1. A CONTRATADA desempenhará os serviços enumerados na CLÁUSULA PRIMEIRA "
            "com todo zelo, diligência, honestidade e sigilo, observada a legislação "
            "vigente resguardando os interesses da CONTRATANTE, sem prejuízo da "
            "dignidade e independência profissionais.\n\n"
            "3.2. Responsabilizar-se-á a CONTRATADA por todos os prepostos que atuarem "
            "nos serviços ora contratados.\n\n"
            "3.3. Obriga-se a CONTRATADA a fornecer à CONTRATANTE, através da ferramenta "
            "de gestão online, dentro do horário normal de expediente (09:00 horas às "
            "18:00 horas, horário de Brasília), todas as informações relativas ao "
            "andamento dos serviços ora contratados."
        ),
    },
    {
        "title": "CLÁUSULA QUARTA - NÃO SÃO DEVERES DA CONTRATADA",
        "content": (
            "4.1. Não é de responsabilidade da CONTRATADA:\n\n"
            "4.1.1. A realização de qualquer tipo de pagamento;\n\n"
            "4.1.2. Negociar com fornecedores, clientes, funcionário e terceiros;\n\n"
            "4.1.3. Tomar decisões gerenciais;\n\n"
            "4.1.4. Qualquer ação de cobrança junto aos clientes da CONTRATANTE;\n\n"
            "4.1.5. A tomada de decisões quanto à emissão ou não de uma Nota Fiscal;\n\n"
            "4.1.6. Omissões de receitas por parte da CONTRATANTE;\n\n"
            "4.1.7. A veracidade das informações;\n\n"
            "4.1.8. O controle do movimento do dinheiro em espécie.\n\n"
            "4.2. A CONTRATADA não assume nenhuma responsabilidade pelas consequências "
            "de informações, declarações ou documentação inidôneas ou incompletas que "
            "lhe forem apresentadas, bem como por omissões próprias da CONTRATANTE "
            "decorrentes do desrespeito às orientações prestadas."
        ),
    },
    {
        "title": "CLÁUSULA QUINTA - DOS DEVERES DA CONTRATANTE",
        "content": (
            "5.1. Obriga-se a CONTRATANTE a fornecer à CONTRATADA todos os dados, "
            "documentos e informações que se façam necessários ao bom desempenho dos "
            "serviços ora contratados. Nenhuma responsabilidade caberá à CONTRATADA, "
            "caso sejam recebidos os dados de maneira intempestiva.\n\n"
            "5.2. É de responsabilidade da CONTRATANTE toda a legalidade dos documentos "
            "apresentados para a prestação do serviço de apoio administrativo.\n\n"
            "5.3. Compromete-se a CONTRATANTE a pagar pontualmente o valor da "
            "mensalidade estabelecido na CLÁUSULA 7.1 deste contrato."
        ),
    },
    {
        "title": "CLÁUSULA SEXTA - CONFIDENCIALIDADE",
        "content": (
            "6.1. As Partes se obrigam a não divulgar os dados e informações sigilosas "
            "às quais venham a ter acesso em razão do projeto desenvolvido, obrigando-se "
            "ainda, a não permitir que nenhum de seus empregados ou terceiros sob a sua "
            "responsabilidade façam uso destas informações para fins diversos do objeto "
            "do presente acordo."
        ),
    },
    {
        "title": "CLÁUSULA SÉTIMA - DOS VALORES E DOS REAJUSTES",
        "content": (
            "7.1. Para a execução dos serviços constantes da Cláusula Primeira, a "
            "CONTRATANTE pagará à CONTRATADA a quantia mensal de {{valor_mensal}} "
            "({{valor_mensal_extenso}}) até o dia 10 (dez) do mês corrente do serviço "
            "prestado, através de boleto bancário a ser encaminhado pela CONTRATADA, "
            "com 5 dias de antecedência.\n\n"
            "7.2. A mensalidade paga após a data avençada na CLÁUSULA 7.1, acarretará à "
            "CONTRATANTE o acréscimo de multa de 2%, mais juros moratórios de 0,08% ao "
            "dia.\n\n"
            "7.3. A mensalidade será reajustada, anualmente, e automaticamente, segundo "
            "a variação do SALÁRIO MÍNIMO no período, limitando ao mínimo de 5% e ao "
            "teto de 10%, considerando-se como mês a fração igual ou superior a 15 "
            "(quinze) dias.\n\n"
            "7.4. O valor da mensalidade previsto na CLÁUSULA 7.1 foi estabelecido "
            "levando em consideração a quantidade de operações financeiras da "
            "CONTRATANTE.\n\n"
            "| Item | Descrição | Limite do Plano |\n"
            "|------|-----------|-----------------|\n"
            "| Plano | Plano contratado | Básico |\n"
            "| Lançamentos | Lançamentos mensais | Até 200 lançamentos |\n"
            "| Notas Fiscais | Emissão de NFS-e | Até 50 notas/mês |\n"
            "| Contas Bancárias | Contas para conciliação | Até 2 contas |\n\n"
            "Serviços contratados:\n\n"
            "{{servicos_contratados}}\n\n"
            "7.5. Caso os limites de uso do plano contratado especificados na CLÁUSULA "
            "7.4 sejam ultrapassados pela CONTRATANTE por dois meses consecutivos será "
            "enviado um comunicado via e-mail juntamente com um termo aditivo ao "
            "contrato informando da migração para o plano superior que atenda as "
            "necessidades da CONTRATANTE no mês seguinte. Se esse termo não for assinado "
            "até o vencimento da mensalidade, os serviços da CONTRATADA poderão ser "
            "limitados até as especificações do plano atual.\n\n"
            "7.6. Os serviços solicitados pela CONTRATANTE não especificados na Cláusula "
            "Primeira serão cobrados pela CONTRATADA em apartado, como extraordinários, "
            "segundo valor específico constante de orçamento previamente aprovado pela "
            "primeira."
        ),
    },
    {
        "title": "CLÁUSULA OITAVA - DA VIGÊNCIA (DO PRAZO)",
        "content": (
            "8.1. O presente contrato terá vigência por prazo de 12 (doze) meses, "
            "podendo ser renovado automaticamente caso não haja denúncia formal (por "
            "escrito) à parte contrária com antecedência mínima de 30 (trinta) dias."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA - RESILIÇÃO",
        "content": (
            "10.1. O presente instrumento poderá ser desfeito por qualquer uma das "
            "partes, em qualquer momento, sem que haja qualquer tipo de motivo relevante, "
            "não obstante a outra parte deverá ser avisada previamente por escrito, no "
            "prazo de 30 (trinta) dias de antecedência."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA PRIMEIRA - RESCISÃO",
        "content": (
            "11.1. O presente instrumento poderá ser rescindido pela CONTRATADA a "
            "qualquer momento se a CONTRATANTE não estiver em dia com o valor da "
            "mensalidade descrito na CLÁUSULA 7.1 deste contrato."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA SEGUNDA - LEI GERAL DE PROTEÇÃO DE DADOS",
        "content": (
            "12.1. Para fins deste CONTRATO:\n\n"
            '12.1.1. "LGPD" significa a Lei Geral de Proteção de Dados Pessoais (Lei nº '
            "13.709/2018);\n\n"
            "12.1.2. As Partes reconhecem que a CONTRATADA realizará o Tratamento de "
            "Dados Pessoais no contexto do fornecimento da prestação dos serviços "
            "oferecidos aos clientes. Nestas atividades de Tratamento, as Partes "
            "reconhecem e acordam que a CONTRATADA é o Operador dos Dados Pessoais, "
            "enquanto o CONTRATANTE é o Controlador dos Dados Pessoais;\n\n"
            "12.1.3. Os dados serão armazenados na plataforma do Controlle e Google "
            "Drive.\n\n"
            "12.2. Obrigações da CONTRATADA:\n\n"
            "12.2.1. Realizar o Tratamento dos Dados Pessoais nos limites e para as "
            "finalidades permitidas por este Contrato;\n\n"
            "12.2.2. Manter os Dados Pessoais no mais absoluto sigilo e exigir dos seus "
            "colaboradores, que de qualquer forma tratem os Dados Pessoais, a observância "
            "dessas obrigações;\n\n"
            "12.3. Da exclusão dos dados:\n\n"
            "12.3.1. Após o término deste Contrato, a CONTRATANTE poderá requerer cópia "
            "dos Dados Pessoais que estejam nos sistemas e em posse da CONTRATADA, bem "
            "como exigir toda e completa exclusão de seus dados através do e-mail "
            "{{email_contratada}}, com o assunto: SOLICITAÇÃO DE EXCLUSÃO DE DADOS;\n\n"
            "12.3.2. Caso a CONTRATANTE não se manifeste, a CONTRATADA realizará a "
            "eliminação, em definitivo de seu sistema, de qualquer registro dos Dados "
            "Pessoais, após o período de 2 (dois) anos."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA TERCEIRA - DISPOSIÇÕES FINAIS",
        "content": (
            "13.1. Os signatários do presente instrumento asseguram e afirmam sob as "
            "penas da lei que são os representantes legais competentes para assumir em "
            "nome das partes as obrigações e responsabilidades descritas neste contrato "
            "e para representar de forma efetiva seus interesses."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA QUARTA - DO FORO",
        "content": (
            "14.1. Fica eleito o Foro da Cidade de {{cidade}}, com expressa renúncia a "
            "qualquer outro, por mais privilegiado que seja, para dirimir as questões "
            "oriundas da interpretação e execução do presente contrato, ou DA CLÁUSULA "
            "COMPROMISSÓRIA (onde houver JUÍZO ARBITRAL) OS CONTRATANTES submeterão à "
            "arbitragem eventuais litígios oriundos do presente contrato. (Lei nº "
            "9.307/96)."
        ),
    },
    {
        "title": "ASSINATURAS",
        "content": (
            "E assim, por estarem as partes justas e contratadas, cientes dos termos "
            "deste contrato, assinam o presente, em 02 (duas) vias de igual teor e para "
            "um só efeito.\n\n"
            "{{cidade}}, {{dia}} de {{mes}} de {{ano}}.\n\n"
            "_________________________________\n"
            "CONTRATADA\n"
            "{{empresa_contratada}}\n\n"
            "_________________________________\n"
            "CONTRATANTE\n"
            "{{nome}}"
        ),
    },
]
