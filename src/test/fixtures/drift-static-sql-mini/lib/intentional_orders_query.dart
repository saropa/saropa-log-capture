// DB_12 fixture: intentional Drift-style query site for static-source ranking tests.
// Normalized fingerprint under test: select * from orders where id = ?

class AppDatabase {
  Object? orders;
  SelectBuilder select(Object? table) => SelectBuilder();
}

class SelectBuilder {
  void watch() {}
}

void intentionalOrdersSite(AppDatabase db) {
  db.select(db.orders).watch();
}
