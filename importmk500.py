#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script d'import de produits Excel vers base PrestaShop
Compatible Windows 7 avec Python 3
"""

import pandas as pd
import mysql.connector
from mysql.connector import Error
import sys
import os
from datetime import datetime

# Configuration de la base de données
DB_CONFIG = {
    'host': '192.168.1.35',  # Votre adresse IP MySQL
    'database': 'mk500_poissondor',
    'user': 'votre_utilisateur',  # À modifier
    'password': 'votre_mot_de_passe',  # À modifier
    'charset': 'utf8mb4'
}

# Configuration des colonnes Excel (à ajuster selon votre fichier)
EXCEL_CONFIG = {
    'file_path': 'votre_fichier.xlsx',  # Chemin vers votre fichier Excel
    'sheet_name': 0,  # Premier onglet
    'columns': {
        'ean13': 'A',  # Colonne EAN13 dans l'Excel
        'name': 'B',   # Colonne nom du produit
        'price': 'E'   # Colonne prix (optionnel)
    }
}

def connect_database():
    """Connexion à la base de données MySQL"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            print(f"✓ Connexion réussie à la base {DB_CONFIG['database']}")
            return connection
    except Error as e:
        print(f"✗ Erreur de connexion MySQL: {e}")
        return None

def read_excel_file(file_path):
    """Lecture du fichier Excel"""
    try:
        if not os.path.exists(file_path):
            print(f"✗ Fichier Excel introuvable: {file_path}")
            return None
            
        # Lecture du fichier Excel
        df = pd.read_excel(file_path, sheet_name=EXCEL_CONFIG['sheet_name'])
        print(f"✓ Fichier Excel lu: {len(df)} lignes trouvées")
        
        # Affichage des premières lignes pour vérification
        print("\nPremières lignes du fichier:")
        print(df.head())
        
        return df
        
    except Exception as e:
        print(f"✗ Erreur lecture Excel: {e}")
        return None

def get_next_product_id(cursor):
    """Récupère le prochain ID disponible pour ps_product"""
    try:
        cursor.execute("SELECT MAX(id_product) FROM ps_product")
        result = cursor.fetchone()
        return (result[0] + 1) if result[0] else 1
    except Error as e:
        print(f"✗ Erreur récupération ID: {e}")
        return 1

def insert_product(cursor, product_data):
    """Insert un produit dans ps_product"""
    try:
        # Requête d'insertion dans ps_product
        query = """
        INSERT INTO ps_product (
            id_product, id_supplier, id_manufacturer, id_category_default,
            id_shop_default, id_tax_rules_group, on_sale, online_only,
            ean13, isbn, upc, ecotax, quantity, minimal_quantity,
            low_stock_threshold, low_stock_alert, price, wholesale_price,
            unity, unit_price_ratio, additional_shipping_cost, reference,
            supplier_reference, location, width, height, depth, weight,
            out_of_stock, additional_delivery_times, customizable,
            uploadable_files, text_fields, active, redirect_type,
            id_type_redirected, available_for_order, available_date,
            show_condition, condition, show_price, indexed, visibility,
            cache_is_pack, cache_has_attachments, is_virtual, cache_default_attribute,
            date_add, date_upd, advanced_stock_management, pack_stock_type,
            state, product_type
        ) VALUES (
            %s, 0, 0, 1, 1, 1, 0, 0, %s, '', '', 0.000000, 0, 1, NULL, 0,
            %s, 0.000000, '', 0.000000, 0.00, '', '', '', 0.000000, 0.000000,
            0.000000, 0.000000, 2, 1, 0, 0, 0, 1, '404', 0, 1, '0000-00-00',
            0, 'new', 1, 1, 'both', 0, 0, 0, 0, NOW(), NOW(), 0, 3, 1, 'standard'
        )
        """
        
        cursor.execute(query, (
            product_data['id_product'],
            product_data['ean13'],
            product_data.get('price', 0.0)
        ))
        
        return True
        
    except Error as e:
        print(f"✗ Erreur insertion ps_product: {e}")
        return False

def insert_product_lang(cursor, product_data):
    """Insert les données de langue dans ps_product_lang"""
    try:
        # Requête d'insertion dans ps_product_lang
        query = """
        INSERT INTO ps_product_lang (
            id_product, id_shop, id_lang, description, description_short,
            link_rewrite, meta_description, meta_keywords, meta_title,
            name, available_now, available_later, delivery_in_stock,
            delivery_out_stock
        ) VALUES (
            %s, 1, 1, '', '', %s, '', '', %s, %s, '', '', '', ''
        )
        """
        
        # Création d'un link_rewrite basé sur le nom
        link_rewrite = product_data['name'].lower().replace(' ', '-').replace('/', '-')
        # Nettoyage pour URL
        link_rewrite = ''.join(c for c in link_rewrite if c.isalnum() or c in '-_')
        
        cursor.execute(query, (
            product_data['id_product'],
            link_rewrite,
            product_data['name'],
            product_data['name']
        ))
        
        return True
        
    except Error as e:
        print(f"✗ Erreur insertion ps_product_lang: {e}")
        return False

def check_existing_product(cursor, ean13):
    """Vérifie si un produit existe déjà avec cet EAN13"""
    try:
        cursor.execute("SELECT id_product FROM ps_product WHERE ean13 = %s", (ean13,))
        result = cursor.fetchone()
        return result[0] if result else None
    except Error as e:
        print(f"✗ Erreur vérification produit existant: {e}")
        return None

def update_existing_product(cursor, product_id, product_data):
    """Met à jour un produit existant dans ps_product"""
    try:
        query = """
        UPDATE ps_product SET 
            price = %s,
            date_upd = NOW()
        WHERE id_product = %s
        """
        cursor.execute(query, (product_data.get('price', 0.0), product_id))
        return True
    except Error as e:
        print(f"✗ Erreur mise à jour ps_product: {e}")
        return False

def update_existing_product_lang(cursor, product_id, product_data):
    """Met à jour les données de langue d'un produit existant"""
    try:
        # Création d'un link_rewrite basé sur le nom
        link_rewrite = product_data['name'].lower().replace(' ', '-').replace('/', '-')
        link_rewrite = ''.join(c for c in link_rewrite if c.isalnum() or c in '-_')
        
        query = """
        UPDATE ps_product_lang SET 
            name = %s,
            meta_title = %s,
            link_rewrite = %s
        WHERE id_product = %s AND id_lang = 1 AND id_shop = 1
        """
        cursor.execute(query, (
            product_data['name'],
            product_data['name'],
            link_rewrite,
            product_id
        ))
        return True
    except Error as e:
        print(f"✗ Erreur mise à jour ps_product_lang: {e}")
        return False

def process_excel_data(connection, df):
    """Traitement des données Excel et insertion/mise à jour en base"""
    cursor = connection.cursor()
    
    inserted_count = 0
    updated_count = 0
    error_count = 0
    
    try:
        for index, row in df.iterrows():
            # Extraction des données (à ajuster selon vos colonnes Excel)
            ean13 = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ''
            name = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ''
            price = float(row.iloc[4]) if pd.notna(row.iloc[4]) and str(row.iloc[4]).replace('.','').isdigit() else 0.0
            
            # Validation des données
            if not ean13 or not name:
                print(f"⚠ Ligne {index+1}: EAN13 ou nom manquant")
                error_count += 1
                continue
            
            print(f"\nTraitement ligne {index+1}: {name} (EAN13: {ean13}) - Prix: {price}€")
            
            # Vérification si le produit existe déjà
            existing_id = check_existing_product(cursor, ean13)
            
            product_data = {
                'id_product': existing_id,
                'ean13': ean13,
                'name': name,
                'price': price
            }
            
            if existing_id:
                print(f"  → Produit existant (ID: {existing_id}), mise à jour complète...")
                
                # Mise à jour ps_product
                product_updated = update_existing_product(cursor, existing_id, product_data)
                
                # Mise à jour ps_product_lang
                lang_updated = update_existing_product_lang(cursor, existing_id, product_data)
                
                if product_updated and lang_updated:
                    updated_count += 1
                    print("  ✓ Produit mis à jour (nom, prix)")
                else:
                    error_count += 1
                    print("  ✗ Erreur lors de la mise à jour")
            else:
                # Insertion nouveau produit
                product_id = get_next_product_id(cursor)
                product_data['id_product'] = product_id
                
                # Insertion dans ps_product
                if insert_product(cursor, product_data):
                    # Insertion dans ps_product_lang
                    if insert_product_lang(cursor, product_data):
                        inserted_count += 1
                        print(f"  ✓ Produit créé (ID: {product_id})")
                    else:
                        error_count += 1
                        # Rollback du produit si l'insertion lang échoue
                        cursor.execute("DELETE FROM ps_product WHERE id_product = %s", (product_id,))
                        print("  ✗ Erreur création ps_product_lang - produit supprimé")
                else:
                    error_count += 1
                    print("  ✗ Erreur création ps_product")
        
        # Validation des transactions
        connection.commit()
        
        print(f"\n" + "="*50)
        print(f"RÉSUMÉ DE L'IMPORT:")
        print(f"Produits créés: {inserted_count}")
        print(f"Produits mis à jour: {updated_count}")
        print(f"Erreurs: {error_count}")
        print(f"Total traité: {inserted_count + updated_count + error_count}")
        print(f"" + "="*50)
        
    except Exception as e:
        print(f"✗ Erreur générale: {e}")
        connection.rollback()
    finally:
        cursor.close()

def main():
    """Fonction principale"""
    print("="*50)
    print("SCRIPT D'IMPORT EXCEL VERS PRESTASHOP")
    print("="*50)
    
    # Vérification du fichier Excel
    excel_file = input("Chemin du fichier Excel (ou Entrée pour 'products.xlsx'): ").strip()
    if not excel_file:
        excel_file = 'products.xlsx'
    
    # Lecture du fichier Excel
    df = read_excel_file(excel_file)
    if df is None:
        return
    
    # Connexion à la base
    connection = connect_database()
    if connection is None:
        return
    
    try:
        # Confirmation avant import
        response = input(f"\nImporter {len(df)} lignes en base? (o/N): ").strip().lower()
        if response not in ['o', 'oui', 'y', 'yes']:
            print("Import annulé.")
            return
        
        # Traitement des données
        process_excel_data(connection, df)
        
    finally:
        if connection.is_connected():
            connection.close()
            print("\n✓ Connexion fermée")

if __name__ == "__main__":
    main()