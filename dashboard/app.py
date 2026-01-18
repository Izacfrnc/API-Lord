import streamlit as st
import json
import os
import pandas as pd
from datetime import datetime
import plotly.express as px
import plotly.graph_objects as go

ARQUIVO = "estoque.json"

# Produtos iniciais
produtos_iniciais = {
    "Xícara Comum Branca": {
        "min": 50, "des": 75, "cost": 13.33, "price": 35.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 20, "cost_unit": 13.33, "total": 266.60}],
        "saidas": []
    },
    "Xícara Mágica": {
        "min": 50, "des": 75, "cost": 16.49, "price": 45.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 50, "cost_unit": 16.49, "total": 824.50}],
        "saidas": []
    },
    "Xícara Prontas": {
        "min": 50, "des": 75, "cost": 13.33, "price": 35.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 10, "cost_unit": 13.33, "total": 133.30}],
        "saidas": []
    },
    "Xícara Colorida": {
        "min": 50, "des": 75, "cost": 13.33, "price": 35.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 25, "cost_unit": 13.33, "total": 333.25}],
        "saidas": []
    },
    "Xícara Comum Preta": {
        "min": 50, "des": 75, "cost": 13.33, "price": 35.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 15, "cost_unit": 13.33, "total": 199.95}],
        "saidas": [{"data": "15/01/2026", "qty": 15, "price_unit": 35.00, "total": 525.00}]
    },
    "Xícara Grande": {
        "min": 15, "des": 22.5, "cost": 14.50, "price": 38.00,
        "entradas": [{"data": "17/01/2026", "tipo": "Inventário", "qty": 15, "cost_unit": 14.50, "total": 217.50}],
        "saidas": [{"data": "05/01/2026", "qty": 15, "price_unit": 38.00, "total": 570.00}]
    },
}

def carregar_estoque():
    if os.path.exists(ARQUIVO):
        with open(ARQUIVO, "r", encoding="utf-8") as f:
            return json.load(f)
    return produtos_iniciais

def salvar_estoque(estoque):
    with open(ARQUIVO, "w", encoding="utf-8") as f:
        json.dump(estoque, f, ensure_ascii=False, indent=4)

def get_data_atual():
    return datetime.now().strftime("%d/%m/%Y")

def calcular_qty_atual(data):
    return sum(e["qty"] for e in data.get("entradas", [])) - sum(s["qty"] for s in data.get("saidas", []))

def calcular_custo_total(data):
    return sum(e["total"] for e in data.get("entradas", []))

st.set_page_config(page_title="Dashboard Estoque", layout="wide", initial_sidebar_state="expanded")

st.title("📦 Dashboard de Estoque")

# Carrega o estoque
if "estoque" not in st.session_state:
    st.session_state.estoque = carregar_estoque()

estoque = st.session_state.estoque

# Sidebar para navegação
st.sidebar.header("Menu")
opcao = st.sidebar.radio("Selecione uma opção:", 
    ["📊 Dashboard", "📈 Controle", "➕ Entrada", "➖ Saída", 
     "📋 Histórico", "➕ Cadastro", "💰 Sugestões de Compras"])

# ===== DASHBOARD =====
if opcao == "📊 Dashboard":
    st.header("Resumo Geral")
    
    col1, col2, col3, col4 = st.columns(4)
    
    total_produtos = len(estoque)
    total_valor = sum(calcular_qty_atual(data) * data["price"] for data in estoque.values())
    total_custo = sum(calcular_custo_total(data) for data in estoque.values())
    total_atual = sum(calcular_qty_atual(data) for data in estoque.values())
    
    col1.metric("🏷️ Total de Produtos", total_produtos)
    col2.metric("💰 Valor em Estoque", f"R$ {total_valor:.2f}")
    col3.metric("📦 Total de Unidades", f"{total_atual:.0f}")
    col4.metric("💵 Custo Total", f"R$ {total_custo:.2f}")
    
    # Gráficos
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Quantidade por Produto")
        df_produtos = pd.DataFrame([
            {"Produto": nome, "Quantidade": calcular_qty_atual(data)}
            for nome, data in estoque.items()
        ])
        fig = px.bar(df_produtos, x="Produto", y="Quantidade", color="Quantidade")
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Valor por Produto")
        df_valor = pd.DataFrame([
            {"Produto": nome, "Valor": calcular_qty_atual(data) * data["price"]}
            for nome, data in estoque.items()
        ])
        fig = px.pie(df_valor, names="Produto", values="Valor")
        st.plotly_chart(fig, use_container_width=True)

# ===== CONTROLE =====
elif opcao == "📈 Controle":
    st.header("Controle de Estoque")
    
    dados = []
    for nome, data in sorted(estoque.items()):
        entrada = sum(e["qty"] for e in data["entradas"])
        saida = sum(s["qty"] for s in data["saidas"])
        atual = entrada - saida
        status = "✅ OK" if atual >= data["min"] else "⚠️ ALERTA"
        
        dados.append({
            "Produto": nome,
            "Entrada": entrada,
            "Saída": saida,
            "Mínimo": data["min"],
            "Desejado": data["des"],
            "Atual": atual,
            "Status": status,
            "Custo Unit.": f"R$ {data['cost']:.2f}",
            "Preço Unit.": f"R$ {data['price']:.2f}"
        })
    
    df = pd.DataFrame(dados)
    st.dataframe(df, use_container_width=True)
    
    # Alerta de baixo estoque
    st.subheader("⚠️ Produtos com Baixo Estoque")
    baixo_estoque = [
        nome for nome, data in estoque.items() 
        if calcular_qty_atual(data) < data["min"]
    ]
    
    if baixo_estoque:
        for produto in baixo_estoque:
            st.warning(f"🔴 {produto} - Quantidade atual abaixo do mínimo!")
    else:
        st.success("✅ Todos os produtos estão acima do nível mínimo!")

# ===== ENTRADA =====
elif opcao == "➕ Entrada":
    st.header("Adicionar Entrada")
    
    col1, col2 = st.columns(2)
    
    with col1:
        nome = st.selectbox("Produto:", sorted(estoque.keys()), key="entrada_produto")
    
    with col2:
        tipo = st.selectbox("Tipo:", ["Compra", "Inventário", "Devolução"], key="entrada_tipo")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        qty = st.number_input("Quantidade:", min_value=0.0, step=1.0, key="entrada_qty")
    
    with col2:
        cost_unit = st.number_input("Custo Unitário:", min_value=0.0, value=float(estoque[nome]["cost"]), step=0.01, key="entrada_custo")
    
    with col3:
        st.write(f"**Total:** R$ {qty * cost_unit:.2f}")
    
    if st.button("✅ Adicionar Entrada"):
        if qty > 0:
            total = qty * cost_unit
            data_atual = get_data_atual()
            estoque[nome]["entradas"].append({
                "data": data_atual, 
                "tipo": tipo, 
                "qty": qty, 
                "cost_unit": cost_unit, 
                "total": total
            })
            salvar_estoque(estoque)
            st.session_state.estoque = estoque
            st.success(f"✅ Entrada adicionada: {qty} de {nome} em {data_atual}. Total: R$ {total:.2f}")
        else:
            st.error("❌ Quantidade deve ser maior que 0!")

# ===== SAÍDA =====
elif opcao == "➖ Saída":
    st.header("Adicionar Saída")
    
    col1, col2 = st.columns(2)
    
    with col1:
        nome = st.selectbox("Produto:", sorted(estoque.keys()), key="saida_produto")
    
    qty_atual = calcular_qty_atual(estoque[nome])
    
    with col2:
        st.write(f"**Quantidade Atual:** {qty_atual:.2f}")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        qty = st.number_input("Quantidade:", min_value=0.0, max_value=qty_atual, step=1.0, key="saida_qty")
    
    with col2:
        price_unit = st.number_input("Preço Unitário:", min_value=0.0, value=float(estoque[nome]["price"]), step=0.01, key="saida_preco")
    
    with col3:
        st.write(f"**Total:** R$ {qty * price_unit:.2f}")
    
    if st.button("✅ Adicionar Saída"):
        if qty > 0 and qty <= qty_atual:
            total = qty * price_unit
            data_atual = get_data_atual()
            estoque[nome]["saidas"].append({
                "data": data_atual, 
                "qty": qty, 
                "price_unit": price_unit, 
                "total": total
            })
            salvar_estoque(estoque)
            st.session_state.estoque = estoque
            st.success(f"✅ Saída adicionada: {qty} de {nome} em {data_atual}. Total: R$ {total:.2f}")
        else:
            st.error("❌ Quantidade inválida ou insuficiente!")

# ===== HISTÓRICO =====
elif opcao == "📋 Histórico":
    st.header("Histórico de Movimentações")
    
    tab1, tab2 = st.tabs(["Entradas", "Saídas"])
    
    with tab1:
        nome = st.selectbox("Selecione o produto:", sorted(estoque.keys()), key="hist_entrada")
        entradas = estoque[nome].get("entradas", [])
        
        if entradas:
            df = pd.DataFrame(entradas)
            df = df[["data", "tipo", "qty", "cost_unit", "total"]]
            df.columns = ["Data", "Tipo", "Quantidade", "Custo Unit.", "Total"]
            st.dataframe(df, use_container_width=True)
        else:
            st.info("Sem entradas registradas.")
    
    with tab2:
        nome = st.selectbox("Selecione o produto:", sorted(estoque.keys()), key="hist_saida")
        saidas = estoque[nome].get("saidas", [])
        
        if saidas:
            df = pd.DataFrame(saidas)
            df = df[["data", "qty", "price_unit", "total"]]
            df.columns = ["Data", "Quantidade", "Preço Unit.", "Total"]
            st.dataframe(df, use_container_width=True)
        else:
            st.info("Sem saídas registradas.")

# ===== CADASTRO =====
elif opcao == "➕ Cadastro":
    st.header("Cadastro de Produto")
    
    nome = st.text_input("Nome do Produto:").strip().title()
    
    if nome:
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            min_qty = st.number_input("Nível Mínimo:", min_value=0.0, value=float(estoque.get(nome, {}).get("min", 0)), step=1.0)
        
        with col2:
            des_qty = st.number_input("Nível Desejado:", min_value=0.0, value=float(estoque.get(nome, {}).get("des", 0)), step=1.0)
        
        with col3:
            cost = st.number_input("Custo Unitário:", min_value=0.0, value=float(estoque.get(nome, {}).get("cost", 0)), step=0.01)
        
        with col4:
            price = st.number_input("Preço Unitário:", min_value=0.0, value=float(estoque.get(nome, {}).get("price", 0)), step=0.01)
        
        if st.button("✅ Salvar Produto"):
            if nome not in estoque:
                estoque[nome] = {"entradas": [], "saidas": []}
            
            estoque[nome]["min"] = min_qty
            estoque[nome]["des"] = des_qty
            estoque[nome]["cost"] = cost
            estoque[nome]["price"] = price
            
            salvar_estoque(estoque)
            st.session_state.estoque = estoque
            st.success(f"✅ {nome} cadastrado/editado com sucesso!")
    else:
        st.info("Digite o nome de um produto para começar.")

# ===== SUGESTÕES DE COMPRA =====
elif opcao == "💰 Sugestões de Compras":
    st.header("Sugestões de Compra")
    
    compras = []
    for nome, data in sorted(estoque.items()):
        atual = calcular_qty_atual(data)
        faltando = max(0, data["des"] - atual)
        if faltando > 0:
            custo_total = faltando * data["cost"]
            compras.append({
                "Produto": nome,
                "Quantidade Atual": atual,
                "Quantidade Desejada": data["des"],
                "Faltando": faltando,
                "Custo Unit.": f"R$ {data['cost']:.2f}",
                "Custo Total": f"R$ {custo_total:.2f}"
            })
    
    if compras:
        df = pd.DataFrame(compras)
        st.dataframe(df, use_container_width=True)
        
        # Resumo total
        total_faltando = sum(float(c["Faltando"]) for c in compras)
        total_custo = sum(float(c["Custo Total"].replace("R$ ", "").replace(",", ".")) for c in compras)
        
        st.divider()
        col1, col2 = st.columns(2)
        col1.metric("📦 Total de Unidades Faltando", f"{total_faltando:.0f}")
        col2.metric("💵 Investimento Necessário", f"R$ {total_custo:.2f}")
    else:
        st.success("✅ Todos os produtos estão no nível desejável!")
