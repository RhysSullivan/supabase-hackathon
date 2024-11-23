import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
const data = db.all("SELECT * FROM read_csv('traffic.csv', sample_size=-1)",
    function(err, res) {
        if (err) {
          console.warn(err);
          return;
        }
        console.log(res)
      }
);
