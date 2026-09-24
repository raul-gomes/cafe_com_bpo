"""Modelo padrão de contrato seedado para todo usuário novo.

Transcrição do documento `docs/contrato.pdf` (Instrumento Particular de
Contrato de Prestação de Serviços de BPO Financeiro). Cada cláusula vira uma
seção; os campos variáveis foram convertidos para tokens.

Sintaxe suportada pelo renderer (`contracts/service.py::render_text`):
- ``{{token}}`` — texto simples resolvido pelo contexto.
- ``{% if token %}...{% endif %}`` — parágrafo condicional; só é incluído
  quando o token tem valor não vazio.
- ``{% for s in servicos %}...{% endfor %}`` — repetição de linha (Anexo I);
  dentro do corpo os campos do item são acessados com ``{{s.campo}}``.

Origem dos tokens:
- CONTRATADA: campos ``contratada_*`` (perfil do usuário + modal).
- CONTRATANTE: campos ``contratante_*`` (prospecto + modal).
- Orçamento vinculado: ``valor_mensal``, ``valor_mensal_extenso``,
  ``proposta_numero``, ``proposta_data``, ``servicos``, ``servicos_pontuais``.
- Gerado pelo sistema: ``contrato_numero``, ``contrato_cidade``,
  ``contrato_data_extenso``.
- Preenchidos no modal ao gerar (campos sem fonte no banco):
  ``sistema_gestao``, ``sistema_titular``, ``horario_atendimento``,
  ``canais_operacionais``, prazos, ``dia_vencimento``, ``forma_pagamento``,
  ``indice_reajuste``, ``data_inicio``, ``foro_comarca``,
  ``autoriza_citacao_cliente``, ``volumes``, ``testemunhas``, entre outros.

Tokens deixados sem valor permanecem literais ``{{...}}`` no rascunho,
aguardando preenchimento manual antes da finalização.
"""

DEFAULT_TEMPLATE_SECTIONS: list[dict[str, str]] = [
    {
        "title": "CONTRATADA E CONTRATANTE",
        "content": (
            "CONTRATADA: {{contratada_razao_social}}, inscrita no CNPJ sob nº "
            "{{contratada_cnpj}}, com sede na {{contratada_endereco}}, "
            "{{contratada_cidade}}/{{contratada_uf}}, CEP {{contratada_cep}}, "
            "neste ato representada por {{contratada_representante_nome}}, "
            "{{contratada_representante_cargo}}, inscrito(a) no CPF sob nº "
            "{{contratada_representante_cpf}}, e-mail {{contratada_email}}.\n\n"
            "CONTRATANTE: {{contratante_razao_social}}, inscrita no CNPJ sob nº "
            "{{contratante_cnpj}}, com sede na {{contratante_endereco}}, "
            "{{contratante_cidade}}/{{contratante_uf}}, CEP {{contratante_cep}}, "
            "neste ato representada por {{contratante_representante_nome}}, "
            "{{contratante_representante_cargo}}, inscrito(a) no CPF sob nº "
            "{{contratante_representante_cpf}}, e-mail {{contratante_email}}.\n\n"
            "Pelo presente instrumento particular, as partes acima qualificadas, "
            "doravante denominadas simplesmente CONTRATADA e CONTRATANTE, ajustam a "
            "prestação de serviços de BPO Financeiro (terceirização de rotinas "
            "financeiras), com base na Proposta Comercial nº {{proposta_numero}}, "
            "emitida em {{proposta_data}} e aceita pela CONTRATANTE, segundo as "
            "cláusulas e condições a seguir."
        ),
    },
    {
        "title": "CLÁUSULA PRIMEIRA – DO OBJETO",
        "content": (
            "1.1. O objeto deste contrato é a prestação, pela CONTRATADA à "
            "CONTRATANTE, dos serviços de BPO Financeiro relacionados no Anexo I – "
            "Escopo e Níveis de Serviço, nas frequências, volumes e prazos ali "
            "previstos, conforme a Proposta Comercial aceita.\n\n"
            "1.2. Os serviços serão executados no sistema de gestão financeira "
            "{{sistema_gestao}}, cuja licença é de titularidade da "
            "{{sistema_titular}}. Quando a licença for da CONTRATANTE, correm por "
            "conta dela a contratação, a manutenção e todos os custos do sistema.\n\n"
            "1.3. Qualquer serviço não relacionado no Anexo I, inclusive aumento de "
            "volume, novas unidades, consultoria ou implantação adicional, depende de "
            "orçamento específico aprovado pela CONTRATANTE e de termo aditivo, não "
            "se presumindo incluído neste contrato.\n\n"
            "1.4. Horas técnicas contratadas em pacote e não utilizadas no período "
            "não serão restituídas nem transferidas para períodos ou serviços futuros."
        ),
    },
    {
        "title": "CLÁUSULA SEGUNDA – DAS CONDIÇÕES DE EXECUÇÃO",
        "content": (
            "2.1. Os serviços serão executados remotamente, nas dependências da "
            "CONTRATADA, em dias úteis, {{horario_atendimento}}, excetuados os "
            "feriados nacionais e os do município sede da CONTRATADA.\n\n"
            "2.2. A CONTRATANTE enviará, em formato digital ou por integração, a "
            "documentação necessária à execução dos serviços, sendo essenciais, sem "
            "caráter exaustivo:\n\n"
            "| Documentos fiscais e de cobrança | Extratos e comprovantes bancários | "
            "Movimento de caixa |\n"
            "|---|---|---|\n"
            "| Notas fiscais, boletos, faturas, recibos, pedidos, contratos e demais "
            "comprovantes que originam os lançamentos. | Extratos de todas as contas, "
            "faturas de cartão, comprovantes de pagamento e de recebimento, borderôs "
            "e avisos de crédito e débito. | Boletim de caixa e relatório de vendas "
            "por cartão ou maquininha, quando houver, em planilha ou pelo sistema de "
            "gestão. |\n\n"
            "2.3. Na reunião de kickoff e mapeamento, a CONTRATANTE detalhará os "
            "processos que serão executados. O registro desse mapeamento integra este "
            "contrato e orienta a execução dos serviços.\n\n"
            "2.4. O acesso ao internet banking será concedido por meio de usuário "
            "secundário com perfil de operador, sem permissão para transferir, sacar "
            "ou aprovar pagamentos. A CONTRATADA não solicitará nem armazenará senhas "
            "de movimentação. A autorização e a liberação de pagamentos são atos "
            "exclusivos da CONTRATANTE.\n\n"
            "2.5. As solicitações operacionais do dia a dia poderão ser feitas pelos "
            "canais {{canais_operacionais}}. Assuntos que alterem o contrato, como "
            "rescisão, reajuste, mudança de escopo e incidentes de dados, só "
            "produzirão efeito se comunicados na forma da Cláusula Décima Primeira."
        ),
    },
    {
        "title": "CLÁUSULA TERCEIRA – DOS PRAZOS",
        "content": (
            "3.1. Os documentos de pagamento deverão ser enviados pela CONTRATANTE, "
            "completos e em boa ordem, com antecedência mínima de "
            "{{prazo_envio_documentos_horas}} horas úteis do vencimento, para "
            "agendamento na data devida. A CONTRATADA não responde pelo agendamento "
            "de documentos recebidos fora desse prazo.\n\n"
            "3.2. As solicitações operacionais serão atendidas em até "
            "{{prazo_atendimento_horas}} horas úteis. Os prazos de cada entrega "
            "recorrente constam do Anexo I.\n\n"
            "PARÁGRAFO ÚNICO\n"
            "Ocorrendo atraso da CONTRATANTE no envio de documentos ou informações, "
            "os prazos da CONTRATADA ficam automaticamente prorrogados na mesma "
            "proporção, sem qualquer ônus para a CONTRATADA."
        ),
    },
    {
        "title": "CLÁUSULA QUARTA – DOS DEVERES DA CONTRATADA",
        "content": (
            "4.1. Executar os serviços com zelo, diligência e honestidade, observada "
            "a legislação vigente e resguardados os interesses da CONTRATANTE.\n\n"
            "4.2. Entregar os relatórios e demais produtos previstos no Anexo I, nos "
            "prazos ali definidos, pelo sistema de gestão, por e-mail ou por portal "
            "web.\n\n"
            "4.3. Responder por seus colaboradores e prepostos, pelos encargos "
            "trabalhistas e previdenciários deles e pelos tributos incidentes sobre "
            "seus honorários.\n\n"
            "4.4. Arcar com multa e juros de títulos que, enviados pela CONTRATANTE "
            "dentro do prazo da cláusula 3.1, deixem de ser agendados por falha da "
            "CONTRATADA, quando o agendamento de pagamentos fizer parte do escopo "
            "contratado. A responsabilidade se limita aos encargos efetivamente "
            "pagos, não alcançando o valor principal do título."
        ),
    },
    {
        "title": "CLÁUSULA QUINTA – DOS LIMITES DA PRESTAÇÃO E DA RESPONSABILIDADE",
        "content": (
            "5.1. Salvo quando expressamente incluído no Anexo I, não faz parte dos "
            "serviços:\n\n"
            "5.1.1. Realizar, aprovar ou liberar qualquer pagamento;\n\n"
            "5.1.2. Negociar com clientes, fornecedores, colaboradores ou terceiros, "
            "inclusive cobrança de inadimplentes;\n\n"
            "5.1.3. Tomar decisões gerenciais, comerciais ou de investimento, "
            "inclusive sobre emitir ou não nota fiscal;\n\n"
            "5.1.4. Controlar dinheiro em espécie;\n\n"
            "5.1.5. Executar escrituração contábil, apuração de tributos, folha de "
            "pagamento ou obrigações acessórias, que são de responsabilidade do "
            "contador da CONTRATANTE.\n\n"
            "5.2. A CONTRATADA não responde por consequências de informações ou "
            "documentos incorretos, incompletos, intempestivos ou inidôneos, por "
            "omissão de receitas, sonegação ou descumprimento de orientações por "
            "parte da CONTRATANTE, nem por decisões tomadas por esta com base nos "
            "relatórios entregues.\n\n"
            "5.3. A indenização devida por uma parte à outra, por qualquer causa "
            "relacionada a este contrato, fica limitada ao valor das mensalidades "
            "efetivamente pagas nos 12 (doze) meses anteriores ao evento, ressalvados "
            "os casos de dolo ou culpa grave.\n\n"
            "5.4. A indisponibilidade de sistemas de terceiros, como bancos, "
            "prefeituras, operadoras de cartão e o próprio sistema de gestão, não "
            "gera responsabilidade para a CONTRATADA. Havendo indisponibilidade "
            "prolongada, a CONTRATADA poderá propor a substituição do sistema, "
            "mediante aviso à CONTRATANTE.\n\n"
            "5.5. A responsabilidade por incidentes de segurança com dados pessoais "
            "segue o Anexo II e a Lei nº 13.709/2018. A CONTRATADA não responde por "
            "incidentes ocorridos em ambientes, dispositivos ou contas sob controle "
            "da CONTRATANTE ou de terceiros por ela contratados.\n\n"
            "NATUREZA DA OBRIGAÇÃO\n"
            "Os serviços prestados configuram obrigação de meio, e não de resultado. "
            "Nenhuma das partes responde pelos resultados econômicos dos negócios da "
            "outra."
        ),
    },
    {
        "title": "CLÁUSULA SEXTA – DOS DEVERES DA CONTRATANTE",
        "content": (
            "6.1. Fornecer à CONTRATADA, em tempo hábil, todos os dados, documentos "
            "e acessos necessários, em especial:\n\n"
            "6.1.1. Contratos firmados com clientes e fornecedores e informações de "
            "cobranças e pagamentos;\n\n"
            "6.1.2. Acesso às contas bancárias, faturas de cartão, boletins de caixa "
            "e extratos, nos termos da cláusula 2.4;\n\n"
            "6.1.3. Certificado digital ou acessos equivalentes, quando necessários à "
            "emissão ou importação de notas fiscais;\n\n"
            "6.1.4. Acesso aos sistemas de gestão utilizados pela empresa.\n\n"
            "6.2. Conferir os títulos agendados e autorizar os pagamentos, sendo de "
            "sua exclusiva responsabilidade a liberação das contas agendadas.\n\n"
            "6.3. Responder pela veracidade e legalidade dos documentos e informações "
            "fornecidos.\n\n"
            "6.4. Manter atualizados seus dados cadastrais e os contatos indicados na "
            "Cláusula Décima Primeira.\n\n"
            "6.5. Pagar pontualmente a remuneração prevista na Cláusula Sétima.\n\n"
            "6.6. Durante a vigência e por 12 (doze) meses após o término deste "
            "contrato, não contratar nem propor trabalho, direta ou indiretamente, a "
            "colaboradores da CONTRATADA que tenham atuado em seus serviços, sob pena "
            "de multa equivalente a 12 (doze) vezes a última remuneração mensal do "
            "profissional, limitada ao valor de 12 (doze) mensalidades vigentes deste "
            "contrato."
        ),
    },
    {
        "title": "CLÁUSULA SÉTIMA – DA REMUNERAÇÃO",
        "content": (
            "7.1. Pelos serviços do Anexo I, a CONTRATANTE pagará à CONTRATADA a "
            "mensalidade de {{valor_mensal}} ({{valor_mensal_extenso}}), com "
            "vencimento no dia {{dia_vencimento}} de cada mês, por meio de "
            "{{forma_pagamento}}, sendo o primeiro vencimento em "
            "{{primeiro_vencimento}}.\n\n"
            "7.2. A mensalidade foi calculada com base nos volumes do Anexo I. Se "
            "esses volumes forem ultrapassados por 2 (dois) meses consecutivos, a "
            "CONTRATADA enviará por e-mail proposta de adequação e termo aditivo. Não "
            "assinado o aditivo até o vencimento seguinte, a CONTRATADA poderá "
            "limitar a execução ao volume contratado.\n\n"
            "7.3. A abertura de filiais, novas unidades ou empresas coligadas cujos "
            "movimentos passem a ser tratados pela CONTRATADA implicará revisão da "
            "mensalidade, mediante aditivo.\n\n"
            "7.4. O atraso no pagamento acarretará multa de 2% (dois por cento), "
            "juros de mora de 1% (um por cento) ao mês, pro rata die, e correção "
            "monetária pelo {{indice_reajuste}}. O não recebimento do boleto ou da "
            "cobrança não dispensa o pagamento no vencimento.\n\n"
            "7.5. A mensalidade será reajustada a cada 12 (doze) meses, contados da "
            "assinatura, pela variação acumulada do {{indice_reajuste}} no período. "
            "Havendo variação negativa, o valor será mantido.\n"
            "{% if valor_implantacao %}"
            "7.6. Pela implantação, será paga a quantia única de {{valor_implantacao}} "
            "({{valor_implantacao_extenso}}), "
            "{{condicao_implantacao}}.\n"
            "{% endif %}"
        ),
    },
    {
        "title": "CLÁUSULA OITAVA – DA VIGÊNCIA E DA RESCISÃO",
        "content": (
            "8.1. Este contrato vigora a partir de {{data_inicio}}, por prazo "
            "indeterminado, com prazo mínimo de {{prazo_minimo_meses}} meses.\n\n"
            "8.2. Qualquer das partes poderá encerrar o contrato mediante aviso "
            "prévio por escrito de {{aviso_previo_dias}} dias, durante o qual os "
            "serviços serão prestados e a remuneração será devida integralmente. A "
            "parte que não cumprir o aviso pagará à outra o valor das mensalidades "
            "correspondentes ao período faltante.\n\n"
            "8.3. Se a CONTRATANTE encerrar o contrato antes do prazo mínimo, pagará "
            "à CONTRATADA, a título de compensação, 50% (cinquenta por cento) das "
            "mensalidades que faltarem para completá-lo.\n\n"
            "8.4. Após {{dias_suspensao_inadimplencia}} dias de atraso no pagamento, "
            "a CONTRATADA poderá suspender agendamentos, relatórios e demais "
            "entregas até a quitação, correndo por conta da CONTRATANTE os efeitos "
            "dessa suspensão. Após 60 (sessenta) dias de atraso, a CONTRATADA poderá "
            "considerar o contrato rescindido.\n\n"
            "8.5. O descumprimento de qualquer cláusula, não sanado em 10 (dez) dias "
            "após notificação, autoriza a outra parte a rescindir o contrato, ficando "
            "a parte infratora sujeita a multa de 2 (duas) mensalidades vigentes.\n\n"
            "8.6. O pedido de recuperação judicial ou a decretação de falência de "
            "qualquer das partes faculta à outra a rescisão imediata.\n\n"
            "TRANSIÇÃO AO FINAL DO CONTRATO\n"
            "Encerrado o contrato por qualquer motivo, a CONTRATADA entregará à "
            "CONTRATANTE, em até 15 (quinze) dias, a exportação dos dados e "
            "relatórios sob sua responsabilidade, e os acessos concedidos serão "
            "revogados. Serviços de transição além dessa entrega serão orçados à "
            "parte."
        ),
    },
    {
        "title": "CLÁUSULA NONA – DA CONFIDENCIALIDADE",
        "content": (
            "9.1. A CONTRATADA manterá sigilo sobre todas as informações a que tiver "
            "acesso em razão deste contrato, inclusive por seus colaboradores e "
            "prepostos, e não as utilizará para fim diverso da prestação dos "
            "serviços, durante a vigência e por 5 (cinco) anos após o seu término.\n\n"
            "9.2. Não estão sujeitas a sigilo as informações que já eram de "
            "conhecimento da CONTRATADA sem obrigação de sigilo, que se tornem "
            "públicas por meio diverso da revelação por ela, ou cuja divulgação seja "
            "exigida por lei ou ordem judicial ou administrativa.\n\n"
            "9.3. Os relatórios e análises produzidos para a CONTRATANTE pertencem a "
            "ela. Métodos, modelos, planilhas e ferramentas de trabalho da CONTRATADA "
            "permanecem de propriedade desta.\n"
            "{% if autoriza_citacao_cliente %}"
            "9.4. A CONTRATANTE autoriza a CONTRATADA a mencioná-la como cliente em "
            "seus materiais institucionais, sem divulgação de qualquer informação "
            "protegida por esta cláusula.\n"
            "{% endif %}"
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA – DA PROTEÇÃO DE DADOS",
        "content": (
            "10.1. O tratamento de dados pessoais decorrente deste contrato observará "
            "a Lei nº 13.709/2018 (LGPD) e as regras do Anexo II – Proteção de "
            "Dados, que integra este instrumento."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA PRIMEIRA – DAS COMUNICAÇÕES",
        "content": (
            "11.1. Notificações e comunicações formais, como rescisão, reajuste, "
            "alteração de escopo e incidentes de dados, serão feitas por escrito, "
            "para os e-mails abaixo, considerando-se recebidas no dia útil seguinte "
            "ao envio:\n\n"
            "| PARTE | E-MAIL PARA NOTIFICAÇÕES |\n"
            "|---|---|\n"
            "| CONTRATADA | {{contratada_email_notificacoes}} |\n"
            "| CONTRATANTE | {{contratante_email_notificacoes}} |\n\n"
            "11.2. Mensagens por aplicativos e demais canais operacionais valem para "
            "a rotina de trabalho, mas não substituem as comunicações formais desta "
            "cláusula."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA SEGUNDA – DISPOSIÇÕES GERAIS",
        "content": (
            "12.1. Este contrato tem natureza civil e não gera vínculo empregatício, "
            "societário ou de representação entre as partes, seus sócios, empregados "
            "ou prepostos.\n\n"
            "12.2. Integram este contrato o Anexo I (Escopo e Níveis de Serviço), o "
            "Anexo II (Proteção de Dados) e a Proposta Comercial nº "
            "{{proposta_numero}}. Em caso de conflito, prevalece este contrato, "
            "exceto quanto a escopo, volumes e preço, em que prevalecem o Anexo I e "
            "a Proposta Comercial.\n\n"
            "12.3. A tolerância de uma parte quanto ao descumprimento da outra não "
            "implica novação ou renúncia de direitos. A nulidade de uma cláusula não "
            "afeta as demais.\n\n"
            "12.4. Nenhuma das partes poderá ceder este contrato sem o consentimento "
            "por escrito da outra.\n\n"
            "12.5. As partes reconhecem a validade da assinatura eletrônica deste "
            "instrumento, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº "
            "14.063/2020, e que, assinado eletronicamente, ele constitui título "
            "executivo extrajudicial, conforme o art. 784, § 4º, do Código de "
            "Processo Civil.\n\n"
            "12.6. Os signatários declaram ter poderes para representar as "
            "respectivas partes e assumir as obrigações aqui previstas."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA TERCEIRA – DO FORO",
        "content": (
            "13.1. Fica eleito o foro da comarca de {{foro_comarca}} para dirimir "
            "questões oriundas deste contrato, com renúncia a qualquer outro, por "
            "mais privilegiado que seja."
        ),
    },
    {
        "title": "ASSINATURAS",
        "content": (
            "E, por estarem de acordo, as partes assinam este instrumento "
            "eletronicamente, para um só efeito.\n\n"
            "{{contrato_cidade}}, {{contrato_data_extenso}}.\n\n"
            "_________________________________\n"
            "CONTRATADA\n"
            "{{contratada_razao_social}}\n"
            "{{contratada_representante_nome}}\n\n"
            "_________________________________\n"
            "CONTRATANTE\n"
            "{{contratante_razao_social}}\n"
            "{{contratante_representante_nome}}\n\n"
            "{% if testemunhas %}"
            "_________________________________\n"
            "TESTEMUNHAS\n"
            "{% for t in testemunhas %}"
            "{{t.nome}} — CPF {{t.cpf}}\n"
            "{% endfor %}"
            "{% endif %}"
        ),
    },
    {
        "title": "ANEXO I – ESCOPO E NÍVEIS DE SERVIÇO",
        "content": (
            "Contrato nº {{contrato_numero}} · Proposta Comercial nº "
            "{{proposta_numero}}\n\n"
            "1. Serviços contratados\n"
            "Serviços recorrentes incluídos na mensalidade, com frequência e prazo "
            "de entrega:\n\n"
            "| SERVIÇO | FREQUÊNCIA | PRAZO DE ENTREGA |\n"
            "|---|---|---|\n"
            "{% for s in servicos %}"
            "| {{s.nome}} | {{s.frequencia}} | {{s.prazo}} |\n"
            "{% if s.descricao %}"
            "| {{s.descricao}} | | |\n"
            "{% endif %}"
            "{% endfor %}\n\n"
            "{% if servicos_pontuais %}"
            "2. Serviços pontuais\n"
            "Serviços executados uma única vez, cobrados conforme a cláusula 7.6 ou "
            "a Proposta Comercial:\n\n"
            "| SERVIÇO | ENTREGA |\n"
            "|---|---|\n"
            "{% for p in servicos_pontuais %}"
            "| {{p.nome}} | {{p.prazo}} |\n"
            "{% if p.descricao %}"
            "| {{p.descricao}} | |\n"
            "{% endif %}"
            "{% endfor %}\n\n"
            "{% endif %}"
            "3. Volumes contratados\n"
            "A mensalidade considera os limites mensais abaixo. Excedê-los aciona a "
            "cláusula 7.2.\n\n"
            "| ITEM | LIMITE MENSAL |\n"
            "|---|---|\n"
            "{% for v in volumes %}"
            "| {{v.item}} | {{v.limite}} |\n"
            "{% endfor %}\n\n"
            "Considera-se lançamento cada registro de pagamento, recebimento ou "
            "transferência nas contas bancárias, cartões e caixa da CONTRATANTE.\n\n"
            "4. Ambiente de trabalho\n\n"
            "| ITEM | DEFINIÇÃO |\n"
            "|---|---|\n"
            "| Sistema de gestão | {{sistema_gestao}} (licença: {{sistema_titular}}) |\n"
            "| Horário de atendimento | Dias úteis, {{horario_atendimento}} |\n"
            "| Canais operacionais | {{canais_operacionais}} |\n"
            "| Envio de documentos de pagamento | Até {{prazo_envio_documentos_horas}}h "
            "úteis antes do vencimento |\n"
            "| Atendimento a solicitações | Até {{prazo_atendimento_horas}}h úteis |"
        ),
    },
    {
        "title": "ANEXO II – PROTEÇÃO DE DADOS",
        "content": (
            "Lei nº 13.709/2018 (LGPD) · Contrato nº {{contrato_numero}}\n\n"
            "1. Glossário\n"
            "Para fins deste contrato, considera-se:\n\n"
            "| DADOS PESSOAIS | TRATAMENTO |\n"
            "|---|---|\n"
            "| Informações que identificam ou tornam identificável uma pessoa "
            "natural, como nome, CPF, RG e endereço. | Toda operação realizada com "
            "dados pessoais, como coleta, uso, acesso, armazenamento, "
            "compartilhamento e eliminação. |\n"
            "| DADOS PESSOAIS SENSÍVEIS | CONTROLADOR |\n"
            "| Dados sobre origem racial ou étnica, convicção religiosa, opinião "
            "política, filiação sindical ou a organização religiosa, filosófica ou "
            "política, saúde, vida sexual, dados genéticos ou biométricos. | Quem "
            "decide sobre o tratamento dos dados pessoais. Neste contrato, a "
            "CONTRATANTE. |\n"
            "| DADOS DE CRIANÇAS E ADOLESCENTES | OPERADOR |\n"
            "| Dados relativos a titulares menores de 18 anos. | Quem realiza o "
            "tratamento em nome do controlador, seguindo suas instruções. Neste "
            "contrato, a CONTRATADA. |\n\n"
            "2. Condições gerais\n"
            "As partes declaram que tratarão dados pessoais somente para a execução "
            "deste contrato e na forma da legislação vigente, e que mantêm medidas de "
            "segurança, técnicas e administrativas, adequadas à proteção desses "
            "dados.\n\n"
            "3. Agentes de tratamento\n"
            "3.1. A CONTRATANTE atua como CONTROLADORA, definindo as finalidades e as "
            "bases legais do tratamento.\n\n"
            "3.2. A CONTRATADA atua como OPERADORA, tratando apenas os dados "
            "necessários à execução dos serviços e segundo as instruções da "
            "CONTROLADORA.\n\n"
            "4. Obrigações da controladora\n"
            "4.1. Fornecer as instruções necessárias ao tratamento, formalizadas por "
            "e-mail.\n\n"
            "4.2. Garantir que o tratamento solicitado é lícito e possui base legal, "
            "nos termos dos arts. 7º e 11 da LGPD, inclusive quanto à coleta e guarda "
            "de eventuais consentimentos.\n\n"
            "4.3. Criar, manter e monitorar o canal de atendimento aos titulares de "
            "dados.\n\n"
            "A CONTROLADORA poderá solicitar informações e relatórios sobre a "
            "adequação da OPERADORA à LGPD.\n\n"
            "5. Obrigações da operadora\n"
            "5.1. Tratar dados pessoais somente nos limites e para as finalidades "
            "deste contrato.\n\n"
            "5.2. Exigir sigilo de todos os colaboradores que tenham acesso aos "
            "dados.\n\n"
            "5.3. Não compartilhar dados com terceiros sem autorização expressa da "
            "CONTROLADORA, salvo os suboperadores do item 6.\n\n"
            "5.4. Responder às solicitações da CONTROLADORA relativas a direitos de "
            "titulares em até 5 (cinco) dias úteis.\n\n"
            "6. Suboperadores e armazenamento\n"
            "A CONTROLADORA autoriza o uso dos seguintes sistemas e fornecedores para "
            "tratamento e armazenamento dos dados: {{plataformas_dados}}. A inclusão "
            "de novo suboperador será comunicada previamente, e a OPERADORA prestará "
            "informações sobre eles em até 72 (setenta e duas) horas, quando "
            "solicitada.\n\n"
            "7. Incidentes de segurança\n"
            "Considera-se incidente qualquer acesso não autorizado, perda, alteração, "
            "vazamento ou tratamento inadequado de dados pessoais que possa gerar "
            "risco aos titulares.\n\n"
            "PRAZO DE COMUNICAÇÃO\n"
            "Verificado um incidente, a OPERADORA comunicará a CONTROLADORA em até 48 "
            "(quarenta e oito) horas, informando data e hora, dados e sistemas "
            "afetados e medidas adotadas, para que esta cumpra suas obrigações "
            "perante a ANPD e os titulares.\n\n"
            "8. Término do tratamento\n"
            "Ao fim do contrato, a OPERADORA devolverá à CONTROLADORA, em formato "
            "eletrônico de uso comum, os dados sob sua guarda e os eliminará em até "
            "30 (trinta) dias, ressalvada a guarda exigida por lei. Os acessos aos "
            "sistemas serão revogados, e licenças contratadas em nome da OPERADORA "
            "poderão ser transferidas à CONTROLADORA, se esta desejar.\n\n"
            "9. Encarregado e penalidades\n"
            "O contato da CONTRATADA para assuntos de proteção de dados é "
            "{{contratada_encarregado_contato}}.\n"
            "O descumprimento deste anexo deverá ser sanado em até 15 (quinze) dias "
            "da notificação, ou em prazo menor, se exigido por lei. Não sanado, a "
            "parte infratora pagará multa equivalente a 2 (duas) mensalidades "
            "vigentes, sem prejuízo da reparação de danos, observado o limite da "
            "cláusula 5.3 do contrato."
        ),
    },
]

# Modelo antigo (docs/CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE BPO FINANCEIRO.docx.pdf).
# Usado para re-seedar usuários que ainda usam o modelo legado sem customização.
LEGACY_DEFAULT_TEMPLATE_SECTIONS: list[dict[str, str]] = [
    {
        "title": "CONTRATADA E CONTRATANTE",
        "content": (
            "CONTRATADA: Empresa {{empresa_contratada}}, inscrita no Cadastro "
            "Nacional de Pessoa Jurídica (CNPJ) sob nº. {{cnpj_contratada}}, "
            "localizada na {{endereco_contratada}}, representada neste ato pelo "
            "sócio(a) administrador(a) {{socio_contratada}}, portador do CPF n°. "
            "{{cpf_contratada}}.\n\n"
            "CONTRATANTE: Empresa {{nome}}, inscrita no Cadastro Nacional de Pessoa "
            "Jurídica (CNPJ) nº. {{cnpj}}, estabelecida na {{endereco}}, neste ato "
            "representado pelo sócio(a) administrador(a) {{socio_contratante}}, "
            "portador do CPF nº. {{cpf_contratante}}.\n\n"
            "Pelo presente instrumento particular de prestação de serviços, "
            "estabelecem as partes, de comum acordo, as seguintes disposições:"
        ),
    },
    {
        "title": "CLÁUSULA PRIMEIRA - DO OBJETO DO CONTRATO",
        "content": (
            "1.1. O objeto do presente Contrato consiste na prestação pela "
            "CONTRATADA à CONTRATANTE dos serviços de apoio nas rotinas financeiras, "
            "ao que tange em alimentar os registros das informações financeiras, "
            "recebida pela CONTRATANTE, no sistema de gestão financeira Controlle, "
            "que a permitirá estruturar os seguintes itens:\n\n"
            "1.1.1. Implantação e Treinamento - 1 (uma) reunião/call com duração de "
            "2 (duas) horas com o consultor responsável pela implantação;\n\n"
            "1.1.2. Controle de contas pagar e a receber;\n\n"
            "1.1.3. Conciliação bancária;\n\n"
            "1.1.4. Emissão/envio de nota fiscal de serviço eletrônica (NFS-e);\n\n"
            "1.1.5. Emissão/envio de boletos;\n\n"
            "1.1.6. Controle de cartão de crédito a pagar;\n\n"
            "1.1.7. Acompanhamento de métricas e resultados operacionais;\n\n"
            "1.1.8. Relatórios Gerenciais;\n\n"
            "1.2. A disponibilização dos relatórios e funcionalidades será definida "
            "de acordo com o plano contratado do sistema de gestão e previamente "
            "acordado para atender às necessidades da CONTRATANTE."
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
            "09:00 horas às 18:00 horas (horário de Brasília). A CONTRATADA "
            "reserva-se de prestar serviços de atendimento nos feriados nacionais e "
            "no feriado do município de {{municipio_contratada}}.\n\n"
            "2.3. A CONTRATADA limita-se nas informações repassadas pela CONTRATANTE "
            "para registrar as operações financeiras e auxiliará a CONTRATANTE a "
            "fazer as leituras e interpretações dos seus resultados financeiros.\n\n"
            "2.4. A documentação indispensável para o desempenho dos serviços "
            "arrolados na Cláusula Primeira será fornecida e enviada pela "
            "CONTRATANTE, consistindo basicamente em:\n\n"
            "2.4.1. Informações Bancárias - agência, conta e senha de consulta ao "
            "Internet banking, que serão utilizadas pela CONTRATADA para acessar o "
            "internet banking (site do banco) e extrair o extrato bancário, o "
            "arquivo OFX, demais informações e comprovantes que possibilita a "
            "CONTRATADA fazer as devidas conferências das movimentações de entradas "
            "e saídas dos valores bancários da CONTRATANTE.\n\n"
            "2.4.2. Número do estabelecimento e senha de acesso ao Portal das Vendas "
            "com Cartão. O registro dos recebimentos das vendas via Cartão "
            "(débito/crédito) contempla a conciliação das vendas diretamente em uma "
            "categoria de receita conforme entrada no banco. Com essas informações "
            "vamos acessar o portal da operadora de cartão para entender como "
            "funciona os recebimentos dos valores das vendas com cartão.\n\n"
            "2.4.3. Os documentos relativos às transações financeiras, tais como "
            "boletos, faturas, recibos, notas fiscais de compra, de venda e de "
            "serviços, comprovantes de depósitos, cópias de cheques, borderôs de "
            "cobrança, contratos, avisos de crédito, avisos de débitos, descontos "
            "de títulos, e demais recebimentos e pagamentos.\n\n"
            "2.5. A documentação deverá ser enviada semanalmente, na medida em que "
            "os fatos forem ocorrendo, pela CONTRATANTE de forma completa e em boa "
            "ordem através dos canais de comunicações disponibilizados pela "
            "CONTRATADA (e-mail, grupo do Whatsapp e pasta no Google Drive).\n\n"
            "2.6. A CONTRATADA possui prazo de 24 (vinte e quatro) horas (hora "
            "comercial) para atender às solicitações da CONTRATANTE e deixar o "
            "sistema atualizado."
        ),
    },
    {
        "title": "CLÁUSULA TERCEIRA - DOS DEVERES DA CONTRATADA",
        "content": (
            "3.1. A CONTRATADA desempenhará os serviços enumerados na CLÁUSULA "
            "PRIMEIRA com todo zelo, diligência, honestidade e sigilo, observada a "
            "legislação vigente resguardando os interesses da CONTRATANTE, sem "
            "prejuízo da dignidade e independência profissionais.\n\n"
            "3.2. Responsabilizar-se-á a CONTRATADA por todos os prepostos que "
            "atuarem nos serviços ora contratados.\n\n"
            "3.3. Obriga-se a CONTRATADA a fornecer à CONTRATANTE, através da "
            "ferramenta de gestão online, dentro do horário normal de expediente "
            "(09:00 horas às 18:00 horas, horário de Brasília), todas as informações "
            "relativas ao andamento dos serviços ora contratados."
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
            "4.1.5. A tomada de decisões quanto à emissão ou não de uma Nota "
            "Fiscal;\n\n"
            "4.1.6. Omissões de receitas por parte da CONTRATANTE;\n\n"
            "4.1.7. A veracidade das informações;\n\n"
            "4.1.8. O controle do movimento do dinheiro em espécie.\n\n"
            "4.2. A CONTRATADA não assume nenhuma responsabilidade pelas "
            "consequências de informações, declarações ou documentação inidôneas ou "
            "incompletas que lhe forem apresentadas, bem como por omissões próprias "
            "da CONTRATANTE decorrentes do desrespeito às orientações prestadas."
        ),
    },
    {
        "title": "CLÁUSULA QUINTA - DOS DEVERES DA CONTRATANTE",
        "content": (
            "5.1. Obriga-se a CONTRATANTE a fornecer à CONTRATADA todos os dados, "
            "documentos e informações que se façam necessários ao bom desempenho dos "
            "serviços ora contratados. Nenhuma responsabilidade caberá à CONTRATADA, "
            "caso sejam recebidos os dados de maneira intempestiva.\n\n"
            "5.2. É de responsabilidade da CONTRATANTE toda a legalidade dos "
            "documentos apresentados para a prestação do serviço de apoio "
            "administrativo.\n\n"
            "5.3. Compromete-se a CONTRATANTE a pagar pontualmente o valor da "
            "mensalidade estabelecido na CLÁUSULA 7.1 deste contrato."
        ),
    },
    {
        "title": "CLÁUSULA SEXTA - CONFIDENCIALIDADE",
        "content": (
            "6.1. As Partes se obrigam a não divulgar os dados e informações "
            "sigilosas às quais venham a ter acesso em razão do projeto "
            "desenvolvido, obrigando-se ainda, a não permitir que nenhum de seus "
            "empregados ou terceiros sob a sua responsabilidade façam uso destas "
            "informações para fins diversos do objeto do presente acordo."
        ),
    },
    {
        "title": "CLÁUSULA SÉTIMA - DOS VALORES E DOS REAJUSTES",
        "content": (
            "7.1. Para a execução dos serviços constantes da Cláusula Primeira, a "
            "CONTRATANTE pagará à CONTRATADA a quantia mensal de {{valor_mensal}} "
            "({{valor_mensal_extenso}}) até o dia 10 (dez) do mês corrente do "
            "serviço prestado, através de boleto bancário a ser encaminhado pela "
            "CONTRATADA, com 5 dias de antecedência.\n\n"
            "7.2. A mensalidade paga após a data avençada na CLÁUSULA 7.1, acarretará "
            "à CONTRATANTE o acréscimo de multa de 2%, mais juros moratórios de "
            "0,08% ao dia.\n\n"
            "7.3. A mensalidade será reajustada, anualmente, e automaticamente, "
            "segundo a variação do SALÁRIO MÍNIMO no período, limitando ao mínimo de "
            "5% e ao teto de 10%, considerando-se como mês a fração igual ou "
            "superior a 15 (quinze) dias.\n\n"
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
            "7.5. Caso os limites de uso do plano contratado especificados na "
            "CLÁUSULA 7.4 sejam ultrapassados pela CONTRATANTE por dois meses "
            "consecutivos será enviado um comunicado via e-mail juntamente com um "
            "termo aditivo ao contrato informando da migração para o plano superior "
            "que atenda as necessidades da CONTRATANTE no mês seguinte. Se esse termo "
            "não for assinado até o vencimento da mensalidade, os serviços da "
            "CONTRATADA poderão ser limitados até as especificações do plano "
            "atual.\n\n"
            "7.6. Os serviços solicitados pela CONTRATANTE não especificados na "
            "Cláusula Primeira serão cobrados pela CONTRATADA em apartado, como "
            "extraordinários, segundo valor específico constante de orçamento "
            "previamente aprovado pela primeira."
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
            "partes, em qualquer momento, sem que haja qualquer tipo de motivo "
            "relevante, não obstante a outra parte deverá ser avisada previamente por "
            "escrito, no prazo de 30 (trinta) dias de antecedência."
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
            '12.1.1. "LGPD" significa a Lei Geral de Proteção de Dados Pessoais (Lei '
            "nº 13.709/2018);\n\n"
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
            "12.2.2. Manter os Dados Pessoais no mais absoluto sigilo e exigir dos "
            "seus colaboradores, que de qualquer forma tratem os Dados Pessoais, a "
            "observância dessas obrigações;\n\n"
            "12.3. Da exclusão dos dados:\n\n"
            "12.3.1. Após o término deste Contrato, a CONTRATANTE poderá requerer "
            "cópia dos Dados Pessoais que estejam nos sistemas e em posse da "
            "CONTRATADA, bem como exigir toda e completa exclusão de seus dados "
            "através do e-mail {{email_contratada}}, com o assunto: SOLICITAÇÃO DE "
            "EXCLUSÃO DE DADOS;\n\n"
            "12.3.2. Caso a CONTRATANTE não se manifeste, a CONTRATADA realizará a "
            "eliminação, em definitivo de seu sistema, de qualquer registro dos Dados "
            "Pessoais, após o período de 2 (dois) anos."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA TERCEIRA - DISPOSIÇÕES FINAIS",
        "content": (
            "13.1. Os signatários do presente instrumento asseguram e afirmam sob as "
            "penas da lei que são os representantes legais competentes para assumir "
            "em nome das partes as obrigações e responsabilidades descritas neste "
            "contrato e para representar de forma efetiva seus interesses."
        ),
    },
    {
        "title": "CLÁUSULA DÉCIMA QUARTA - DO FORO",
        "content": (
            "14.1. Fica eleito o Foro da Cidade de {{cidade}}, com expressa renúncia "
            "a qualquer outro, por mais privilegiado que seja, para dirimir as "
            "questões oriundas da interpretação e execução do presente contrato, ou "
            "DA CLÁUSULA COMPROMISSÓRIA (onde houver JUÍZO ARBITRAL) OS CONTRATANTES "
            "submeterão à arbitragem eventuais litígios oriundos do presente "
            "contrato. (Lei nº 9.307/96)."
        ),
    },
    {
        "title": "ASSINATURAS",
        "content": (
            "E assim, por estarem as partes justas e contratadas, cientes dos termos "
            "deste contrato, assinam o presente, em 02 (duas) vias de igual teor e "
            "para um só efeito.\n\n"
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
