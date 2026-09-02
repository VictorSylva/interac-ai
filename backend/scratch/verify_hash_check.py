from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
hash_val = "$pbkdf2-sha256$29000$TYmxFgJgbA3B2JtzrpVS6g$O0YbduURCV6I1OgPeGjFjE9I5pHntfWnKFUCf8Tke.g"

print("Interac@2026:", pwd_context.verify("Interac@2026", hash_val))
print("password123:", pwd_context.verify("password123", hash_val))
print("Setecs@55:", pwd_context.verify("Setecs@55", hash_val))
