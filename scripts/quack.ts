import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
db.run("CREATE TEMPORARY TABLE temp_traffic AS SELECT * FROM read_csv_auto('traffic.csv', sample_size=-1)");

db.all("DESCRIBE temp_traffic", function(err, res) {
    if (err) {
      console.warn(err);
      return;
    }
    console.log(res)
});

db.all("SELECT * FROM temp_traffic LIMIT 1", function(err, res) {
    if (err) {
      console.warn(err);
      return;
    }
    console.log(res)
});