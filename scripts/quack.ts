import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
db.all("SELECT * FROM read_csv_auto('traffic.csv', sample_size=-1) LIMIT 1",
    function(err, res) {
        // if (err) {
        //   console.warn(err);
        //   return;
        // }
        // console.log(res)
      }
);
db.run("CREATE TEMPORARY TABLE temp_traffic AS SELECT * FROM read_csv_auto('traffic.csv', sample_size=-1)");

db.all("DESCRIBE temp_traffic", function(err, res) {
    if (err) {
      console.warn(err);
      return;
    }
    console.log(res)
});
