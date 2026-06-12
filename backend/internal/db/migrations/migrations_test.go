package migrations

import "testing"

func TestMigrationsAreOrdered(t *testing.T) {
	if len(all) == 0 {
		t.Fatal("expected at least one migration")
	}

	previous := 0
	for _, migration := range all {
		if migration.Version <= previous {
			t.Fatalf("migration %q is not ordered", migration.Name)
		}
		if migration.Name == "" {
			t.Fatalf("migration %d missing name", migration.Version)
		}
		if migration.SQL == "" {
			t.Fatalf("migration %d missing SQL", migration.Version)
		}
		previous = migration.Version
	}
}
