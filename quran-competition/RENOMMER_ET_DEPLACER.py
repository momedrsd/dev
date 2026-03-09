import os
import shutil

SRC_WARSH  = r"C:\images_warsh"
SRC_HAFS   = r"C:\images_hafs"
DEST_WARSH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "quran", "warsh")
DEST_HAFS  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public", "quran", "hafs")

def copier(src, dest, nom):
    if not os.path.exists(src):
        print(f"[ERREUR] Dossier introuvable : {src}")
        return
    os.makedirs(dest, exist_ok=True)
    count = 0
    for i in range(1, 605):
        fichier = os.path.join(src, f"{i}.png")
        if os.path.exists(fichier):
            destination = os.path.join(dest, f"page_{i:03d}.png")
            shutil.copy2(fichier, destination)
            count += 1
    print(f"[OK] {nom} : {count} pages copiees")

print()
print("=" * 50)
print("  RENOMMAGE ET DEPLACEMENT DES PAGES")
print("=" * 50)
print()
copier(SRC_WARSH, DEST_WARSH, "Warsh")
copier(SRC_HAFS,  DEST_HAFS,  "Hafs")
print()
print("TERMINE ! Lancez maintenant AGRANDIR_PAGES.bat")
print()
input("Appuyez sur Entree pour quitter...")
