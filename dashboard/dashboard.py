import json
import os
from datetime import datetime

ARQUIVO = "estoque.json"

# Produtos iniciais baseados nas suas imagens
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

estoque = carregar_estoque()

def get_data_atual():
    return datetime.now().strftime("%d/%m/%Y")

def calcular_qty_atual(data):
    return sum(e["qty"] for e in data.get("entradas", [])) - sum(s["qty"] for s in data.get("saidas", []))

def cadastro():
    nome = input("Nome do produto: ").strip().title()
    if nome not in estoque:
        estoque[nome] = {"entradas": [], "saidas": []}
    
    try:
        estoque[nome]["min"] = float(input(f"Nível Mínimo (atual: {estoque[nome].get('min', 0)}): ") or estoque[nome].get("min", 0))
        estoque[nome]["des"] = float(input(f"Nível Desejado (atual: {estoque[nome].get('des', 0)}): ") or estoque[nome].get("des", 0))
        estoque[nome]["cost"] = float(input(f"Custo Unitário (atual: {estoque[nome].get('cost', 0)}): ") or estoque[nome].get("cost", 0))
        estoque[nome]["price"] = float(input(f"Preço Unitário (atual: {estoque[nome].get('price', 0)}): ") or estoque[nome].get("price", 0))
        print(f"{nome} cadastrado/editado!")
        salvar_estoque(estoque)
    except ValueError:
        print("Valor inválido!")

def entrada():
    nome = input("Nome do produto: ").strip().title()
    if nome not in estoque:
        print("Produto não encontrado!")
        return
    try:
        qty = float(input("Quantidade: "))
        if qty <= 0:
            raise ValueError
        tipo = input("Tipo (ex: Inventário, Compra): ").strip() or "Compra"
        cost_unit = float(input(f"Custo Unitário (padrão: {estoque[nome]['cost']}): ") or estoque[nome]["cost"])
        total = qty * cost_unit
        data_atual = get_data_atual()
        estoque[nome]["entradas"].append({"data": data_atual, "tipo": tipo, "qty": qty, "cost_unit": cost_unit, "total": total})
        print(f"Entrada adicionada: {qty} de {nome} em {data_atual}. Total: R$ {total:.2f}")
        salvar_estoque(estoque)
    except ValueError:
        print("Valor inválido!")

def saida():
    nome = input("Nome do produto: ").strip().title()
    if nome not in estoque:
        print("Produto não encontrado!")
        return
    qty_atual = calcular_qty_atual(estoque[nome])
    try:
        qty = float(input("Quantidade: "))
        if qty <= 0 or qty > qty_atual:
            print("Quantidade inválida ou insuficiente!")
            return
        price_unit = float(input(f"Preço Unitário (padrão: {estoque[nome]['price']}): ") or estoque[nome]["price"])
        total = qty * price_unit
        data_atual = get_data_atual()
        estoque[nome]["saidas"].append({"data": data_atual, "qty": qty, "price_unit": price_unit, "total": total})
        print(f"Saída adicionada: {qty} de {nome} em {data_atual}. Total: R$ {total:.2f}")
        salvar_estoque(estoque)
    except ValueError:
        print("Valor inválido!")

def ver_historico(tipo):
    nome = input("Nome do produto: ").strip().title()
    if nome not in estoque:
        print("Produto não encontrado!")
        return
    hist = estoque[nome].get(tipo + "s", [])
    if not hist:
        print(f"Sem {tipo}s registradas.")
        return
    print(f"\nHISTÓRICO DE {tipo.upper()}S PARA {nome}:")
    print("-" * 80)
    if tipo == "entrada":
        print(f"{'Data':<12} {'Tipo':<15} {'Qty':>8} {'Custo Unit.':>12} {'Total':>12}")
        for h in hist:
            print(f"{h['data']:<12} {h['tipo']:<15} {h['qty']:>8.2f} R${h['cost_unit']:>11.2f} R${h['total']:>11.2f}")
    else:
        print(f"{'Data':<12} {'Qty':>8} {'Preço Unit.':>12} {'Total':>12}")
        for h in hist:
            print(f"{h['data']:<12} {h['qty']:>8.2f} R${h['price_unit']:>11.2f} R${h['total']:>11.2f}")
    print("-" * 80)

def controle():
    if not estoque:
        print("Estoque vazio.")
        return
    print("\nCONTROLE DE ESTOQUE:")
    print("-" * 80)
    print(f"{'Produto':<25} {'Entrada':>8} {'Saída':>8} {'Mín':>8} {'Des':>8} {'Atual':>8} {'Status':<15}")
    total_entrada = total_saida = total_min = total_des = total_atual = 0
    for nome, data in sorted(estoque.items()):
        entrada = sum(e["qty"] for e in data["entradas"])
        saida = sum(s["qty"] for s in data["saidas"])
        atual = entrada - saida
        status = "OK" if atual >= data["min"] else "ALERTA: Baixo!"
        print(f"{nome:<25} {entrada:>8.2f} {saida:>8.2f} {data['min']:>8.2f} {data['des']:>8.2f} {atual:>8.2f} {status:<15}")
        total_entrada += entrada
        total_saida += saida
        total_min += data["min"]
        total_des += data["des"]
        total_atual += atual
    print("-" * 80)
    print(f"{'Quantidade Total':<25} {total_entrada:>8.2f} {total_saida:>8.2f} {total_min:>8.2f} {total_des:>8.2f} {total_atual:>8.2f}")

def dashboard():
    total_produtos = len(estoque)
    total_valor = sum(calcular_qty_atual(data) * data["price"] for data in estoque.values())
    total_des = sum(data["des"] for data in estoque.values())
    total_atual = sum(calcular_qty_atual(data) for data in estoque.values())
    pct_des = (total_atual / total_des * 100) if total_des > 0 else 0
    print("\nDASHBOARD:")
    print(f"Total de Produtos: {total_produtos}")
    print(f"Valor Total em Estoque (preço venda): R$ {total_valor:.2f}")
    print(f"% do Estoque Desejável: {pct_des:.2f}%")

def compras():
    print("\nSUGESTÕES DE COMPRAS:")
    print("-" * 50)
    for nome, data in sorted(estoque.items()):
        atual = calcular_qty_atual(data)
        faltando = max(0, data["des"] - atual)
        if faltando > 0:
            custo_total = faltando * data["cost"]
            print(f"{nome:<25} Faltando: {faltando:.2f} unid. Custo est.: R$ {custo_total:.2f}")
    print("-" * 50)

# Menu principal
while True:
    print("\nMENU PRINCIPAL:")
    print("1. Cadastro de Produto")
    print("2. Entrada (Adicionar)")
    print("3. Saída (Remover)")
    print("4. Ver Histórico de Entradas")
    print("5. Ver Histórico de Saídas")
    print("6. Controle (Consultar)")
    print("7. Dashboard (Resumo)")
    print("8. Compras (Sugestões)")
    print("9. Sair")
    
    op = input("→ Escolha: ").strip()
    
    if op == "1":
        cadastro()
    elif op == "2":
        entrada()
    elif op == "3":
        saida()
    elif op == "4":
        ver_historico("entrada")
    elif op == "5":
        ver_historico("saida")
    elif op == "6":
        controle()
    elif op == "7":
        dashboard()
    elif op == "8":
        compras()
    elif op == "9":
        print("Tchau! Dados salvos.")
        break
    else:
        print("Opção inválida!")