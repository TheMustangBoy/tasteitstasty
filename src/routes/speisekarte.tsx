import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { type MenuItem } from "@/data/menu";
import { useShop } from "@/context/shop";
import { ProductCard } from "@/components/shop/product-card";
import { ProductDialog } from "@/components/shop/product-dialog";

export const Route = createFileRoute("/speisekarte")({
  head: () => ({
    meta: [
      { title: "Speisekarte – Taste It's Tasty Food Truck Dachau" },
      {
        name: "description",
        content:
          "Smash Burger und Beilagen zur Abholung: Tripple Smash, Chili Cheese, Trüffel Fries und mehr.",
      },
      { property: "og:title", content: "Speisekarte – Taste It's Tasty" },
      {
        property: "og:description",
        content: "Burger und Beilagen vom Smash-Burger-Food-Truck in Dachau.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [open, setOpen] = useState(false);
  const { products, overrides, catalog } = useShop();
  const categories = [...catalog.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl sm:text-5xl">Speisekarte</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Alles frisch auf Bestellung. Aktuell ausschließlich Abholung am Truck.
      </p>

      <div className="mt-10 space-y-14">
        {categories.map((category) => (
          <section key={category.id} id={category.id}>
            <div className="border-b border-border pb-4">
              <h2 className="text-2xl sm:text-3xl">
                <span className="text-flame-gradient">{category.label}</span>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{category.note}</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products
                .filter((item) => item.category === category.id)
                .filter((item) => overrides[item.id]?.available !== false)
                .map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    soldOut={overrides[item.id]?.soldOut === true}
                    onSelect={() => {
                      setSelected(item);
                      setOpen(true);
                    }}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>

      <ProductDialog item={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
