"""
AGRANDISSEMENT DES PAGES DU CORAN
==================================
Ce script agrandit les images de 456x672 vers 1240x1754 (ou plus)
en utilisant l'algorithme Lanczos - le meilleur pour le texte arabe.

INSTALLATION (une seule fois) :
  pip install Pillow

UTILISATION :
  python AGRANDIR_PAGES.py
"""

import os
import sys
import time

try:
    from PIL import Image
except ImportError:
    print("=" * 60)
    print("  ERREUR : Pillow n'est pas installe !")
    print("  Ouvrez un terminal et tapez :")
    print("  pip install Pillow")
    print("=" * 60)
    input("Appuyez sur Entree pour quitter...")
    sys.exit(1)

# ── Configuration ─────────────────────────────────────────────
LARGEUR_CIBLE  = 1240
HAUTEUR_CIBLE  = 2010  # Ratio conservé depuis 456x739
QUALITE_PNG    = 9       # 0 (pas de compression) à 9 (max compression)
EXTENSION      = ".png"  # Extension des fichiers source

# Dossiers à traiter (relatifs à ce script)
DOSSIERS = {
    "Warsh": "public/quran/warsh",
    "Hafs":  "public/quran/hafs",
}
# ──────────────────────────────────────────────────────────────


def agrandir_dossier(nom, chemin_dossier):
    """Agrandit toutes les images d'un dossier."""

    if not os.path.exists(chemin_dossier):
        print(f"\n  [!] Dossier introuvable : {chemin_dossier}")
        print(f"      Ignoré.")
        return 0

    # Lister les fichiers PNG
    fichiers = sorted([
        f for f in os.listdir(chemin_dossier)
        if f.lower().endswith(EXTENSION) and f.startswith("page_")
    ])

    if not fichiers:
        print(f"\n  [!] Aucune image PNG trouvée dans {chemin_dossier}")
        return 0

    total = len(fichiers)
    print(f"\n  [{nom}] {total} pages trouvées → agrandissement vers {LARGEUR_CIBLE}×{HAUTEUR_CIBLE}px")
    print(f"  {'─' * 50}")

    debut = time.time()
    traites = 0
    ignores = 0

    for i, fichier in enumerate(fichiers, 1):
        chemin = os.path.join(chemin_dossier, fichier)

        try:
            with Image.open(chemin) as img:
                w, h = img.size

                # Vérifier si déjà à la bonne résolution
                if w >= LARGEUR_CIBLE and h >= HAUTEUR_CIBLE:
                    ignores += 1
                    continue

                # Agrandir avec Lanczos (meilleure qualité pour le texte)
                img_grande = img.resize(
                    (LARGEUR_CIBLE, HAUTEUR_CIBLE),
                    Image.LANCZOS
                )

                # Sauvegarder (remplace l'original)
                img_grande.save(chemin, "PNG", compress_level=QUALITE_PNG)
                traites += 1

        except Exception as e:
            print(f"  [ERREUR] {fichier} : {e}")
            continue

        # Afficher progression
        if i % 50 == 0 or i == total:
            elapsed = time.time() - debut
            pct = (i / total) * 100
            restant = (elapsed / i) * (total - i) if i > 0 else 0
            print(f"  {i:3d}/{total} ({pct:5.1f}%)  —  "
                  f"Temps écoulé: {elapsed:.0f}s  —  "
                  f"Restant: {restant:.0f}s")

    elapsed = time.time() - debut
    print(f"\n  ✓ {nom} terminé : {traites} agrandies, {ignores} ignorées (déjà OK)")
    print(f"  Durée totale : {elapsed:.0f} secondes")
    return traites


def main():
    # Aller dans le dossier du script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    print()
    print("=" * 60)
    print("  AGRANDISSEMENT DES PAGES DU CORAN")
    print(f"  Résolution cible : {LARGEUR_CIBLE} × {HAUTEUR_CIBLE} px")
    print("=" * 60)

    # Vérifier quels dossiers existent et ont des images
    dossiers_disponibles = {}
    for nom, chemin in DOSSIERS.items():
        if os.path.exists(chemin):
            nb = len([f for f in os.listdir(chemin)
                     if f.lower().endswith(EXTENSION) and f.startswith("page_")])
            if nb > 0:
                dossiers_disponibles[nom] = (chemin, nb)

    if not dossiers_disponibles:
        print("\n  [!] Aucune image trouvée dans les dossiers warsh/ ou hafs/")
        print("      Lancez d'abord COPIER_PAGES_AYAT.bat")
        input("\n  Appuyez sur Entree pour quitter...")
        return

    # Afficher les dossiers disponibles
    print("\n  Dossiers disponibles :")
    for nom, (chemin, nb) in dossiers_disponibles.items():
        print(f"    - {nom} : {nb} pages  ({chemin})")

    print()
    print("  Que voulez-vous agrandir ?")
    print()

    options = list(dossiers_disponibles.keys())
    for i, nom in enumerate(options, 1):
        print(f"    [{i}] {nom} uniquement")
    print(f"    [{len(options)+1}] Les deux")
    print()

    choix = input("  Votre choix : ").strip()

    dossiers_a_traiter = []
    if choix == "1" and len(options) >= 1:
        dossiers_a_traiter = [options[0]]
    elif choix == "2" and len(options) >= 2:
        dossiers_a_traiter = [options[1]]
    elif choix == str(len(options) + 1):
        dossiers_a_traiter = options
    elif choix == "1" and len(options) == 1:
        dossiers_a_traiter = options
    else:
        # Si un seul dossier disponible, traiter directement
        if len(options) == 1:
            dossiers_a_traiter = options
        else:
            print("  Choix invalide.")
            input("  Appuyez sur Entree pour quitter...")
            return

    print()
    print("  ⚠️  ATTENTION : Les images originales seront remplacées.")
    print("      Assurez-vous d'avoir une copie de sauvegarde si nécessaire.")
    print()
    confirm = input("  Confirmer ? (o/n) : ").strip().lower()

    if confirm not in ("o", "oui", "y", "yes"):
        print("  Annulé.")
        input("  Appuyez sur Entree pour quitter...")
        return

    # Traitement
    total_traites = 0
    debut_global = time.time()

    for nom in dossiers_a_traiter:
        chemin, _ = dossiers_disponibles[nom]
        total_traites += agrandir_dossier(nom, chemin)

    elapsed_global = time.time() - debut_global

    print()
    print("=" * 60)
    print(f"  TERMINÉ !")
    print(f"  {total_traites} pages agrandies en {elapsed_global:.0f} secondes")
    print(f"  Résolution finale : {LARGEUR_CIBLE} × {HAUTEUR_CIBLE} px")
    print()
    print("  Lancez DEMARRER.bat pour démarrer la compétition !")
    print("=" * 60)
    print()
    input("  Appuyez sur Entree pour quitter...")


if __name__ == "__main__":
    main()
