import duckdb from "duckdb";

const db = new duckdb.Database(":memory:");
db.run("CREATE TEMPORARY TABLE temp_traffic AS SELECT * FROM read_csv_auto('traffic.csv', sample_size=-1)");

db.all("DESCRIBE temp_traffic", function(err, res) {
    if (err) {
      console.warn(err);
      return;
    }
    // print the results with no formatting, whitespace, etc.
    // console.log(JSON.stringify(res, null, 0))
});

db.all(`SELECT DISTINCT
    analysis_neighborhood
FROM temp_traffic
WHERE analysis_neighborhood IS NOT NULL
AND analysis_neighborhood != ''
ORDER BY analysis_neighborhood;`, function(err, res) {
    if (err) {
      console.warn(err);
      return;
    }
    console.log(res)
});