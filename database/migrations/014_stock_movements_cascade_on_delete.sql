-- Permitir borrar productos: al eliminar un producto se borran sus movimientos de stock.
-- Si tu FK se llama distinto, revisá con: SHOW CREATE TABLE stock_movements;
ALTER TABLE stock_movements DROP FOREIGN KEY stock_movements_ibfk_1;
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_ibfk_1
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
