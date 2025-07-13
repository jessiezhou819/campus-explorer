import JSZip from "jszip";
import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";

import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);

export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}

describe("InsightFacade", function () {
	let facade: IInsightFacade;

	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let textfile: string;
	let zipNoCourseFolder: string;
	let zipNoFile: string;
	let noResultKey: string;
	let courseNoSection: string;
	let sectionMissingKeys: string;
	let sectionNoKey: string;
	let validAndInvalidSections: string;
	let sectionEmptyValues: string;
	let oneValidCourse: string;
	let mixedCourses: string;
	let zipWrongFileType: string;
	let invalidCourseJson: string;
	let resultWrongType: string;
	let section5000: string;
	let campus: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		oneValidCourse = await getContentFromArchives("one_valid_course.zip");
		mixedCourses = await getContentFromArchives("mixed_courses.zip");
		validAndInvalidSections = await getContentFromArchives("valid_and_invalid_sections.zip");
		zipNoCourseFolder = await getContentFromArchives("blank.zip");
		zipNoFile = await getContentFromArchives("courses_no_file.zip");
		sectionMissingKeys = await getContentFromArchives("section_missing_id_avg.zip");
		sectionNoKey = await getContentFromArchives("section_no_key.zip");
		invalidCourseJson = await getContentFromArchives("invalid_courses.zip");
		textfile = await getContentFromArchives("pair.txt");
		courseNoSection = await getContentFromArchives("course_no_section.zip");
		zipWrongFileType = await getContentFromArchives("zip_wrong_formats.zip");
		noResultKey = await getContentFromArchives("no_result_key.zip");
		sectionEmptyValues = await getContentFromArchives("section_empty_values.zip");
		resultWrongType = await getContentFromArchives("result_wrong_type.zip");
		section5000 = await getContentFromArchives("5000_sections.zip");
		campus = await getContentFromArchives("campus.zip");
		await clearDisk();
	});

	describe("AddDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		after(async function () {
			await clearDisk();
		});

		it("should add a rooms dataset", async function () {
			try {
				const result = await facade.addDataset("rooms", campus, InsightDatasetKind.Rooms);
				expect(result).to.deep.equal(["rooms"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add, crash, and add again", async function () {
			try {
				await facade.addDataset("rooms", campus, InsightDatasetKind.Rooms);
				const newInstance = new InsightFacade();
				const result = await newInstance.addDataset("b", campus, InsightDatasetKind.Rooms);
				expect(result).to.deep.equal(["rooms", "b"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should reject with an empty dataset id", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with an id that is only whitespace", async function () {
			// Read the "Free Mutant Walkthrough" in the spec for tips on how to get started!
			try {
				await facade.addDataset(" ", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with an id that contains an underscore", async function () {
			try {
				await facade.addDataset("bad_id", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a duplicate id", async function () {
			try {
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
			try {
				await facade.addDataset("ubc", oneValidCourse, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		// Invalid content
		it("should reject with empty content", async function () {
			try {
				await facade.addDataset("null", "", InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a non-base64 encoded dataset (random string)", async function () {
			try {
				await facade.addDataset("notbase64", "notbase64", InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with base64 of a .txt file (not a zip)", async function () {
			try {
				await facade.addDataset("txt", textfile, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with empty zip", async function () {
			const zip = new JSZip();
			const content = await zip.generateAsync({ type: "base64" });
			try {
				await facade.addDataset("empty", content, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a zip file with no course folder inside", async function () {
			try {
				await facade.addDataset("emptyzip", zipNoCourseFolder, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a zip file with course folder but no files", async function () {
			try {
				await facade.addDataset("nofile", zipNoFile, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a file with no result key", async function () {
			try {
				await facade.addDataset("noresultkey", noResultKey, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a courses with invalid json (empty, {}, 'hi':'aaa')", async function () {
			try {
				await facade.addDataset("notjson", invalidCourseJson, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a courses with result but wrong type for value", async function () {
			try {
				await facade.addDataset("notjson", resultWrongType, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject if non-JSON files are in the courses folder", async function () {
			try {
				await facade.addDataset("nonjsonfile", zipWrongFileType, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a course with no sections", async function () {
			try {
				await facade.addDataset("nosection", courseNoSection, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		// sections
		it("should reject with a section with no keys", async function () {
			try {
				await facade.addDataset("nosectionkey", sectionNoKey, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with a section with missing keys", async function () {
			try {
				await facade.addDataset("missingkeys", sectionMissingKeys, InsightDatasetKind.Sections);
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		// it("should reject for Room dataset kind", async function () {
		// 	try {
		// 		await facade.addDataset("room", oneValidCourse, InsightDatasetKind.Rooms);
		// 		expect.fail("Should have thrown!");
		// 	} catch (err) {
		// 		expect(err).to.be.instanceOf(InsightError);
		// 	}
		// });

		// Valid content
		it("should add a section with empty string values", async function () {
			try {
				const result = await facade.addDataset("emptyvalues", sectionEmptyValues, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["emptyvalues"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add the dataset with 1 valid section", async function () {
			try {
				const result = await facade.addDataset("valid", oneValidCourse, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["valid"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add the dataset with 1 valid section with some invalid", async function () {
			try {
				const result = await facade.addDataset("validandinvalid", validAndInvalidSections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["validandinvalid"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add two different datasets", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				const result = await facade.addDataset("b", validAndInvalidSections, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["a", "b"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add the dataset with 1 valid course and 1 invalid course", async function () {
			try {
				const result = await facade.addDataset("mixed", mixedCourses, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["mixed"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should add, crash, and add again", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				const newInstance = new InsightFacade();
				const result = await newInstance.addDataset("b", oneValidCourse, InsightDatasetKind.Sections);
				expect(result).to.deep.equal(["a", "b"]);
			} catch (err) {
				expect.fail(`addDataset should not have thrown, but threw ${err}`);
			}
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		after(async function () {
			await clearDisk();
		});

		it("should reject with an id with whitespaces", async function () {
			try {
				await facade.removeDataset("  ");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with an id with underscore", async function () {
			try {
				await facade.removeDataset("o_o");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject removing a dataset that doesn't exist", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				await facade.addDataset("b", oneValidCourse, InsightDatasetKind.Sections);
				await facade.removeDataset("c");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});

		it("should reject removing a dataset that is already removed", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				await facade.removeDataset("a");
				await facade.removeDataset("a");
				expect.fail("Should have thrown!");
			} catch (err) {
				expect(err).to.be.instanceOf(NotFoundError);
			}
		});

		// Valid cases
		it("should succeed removing a dataset", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				const result = await facade.removeDataset("a");
				expect(result).to.deep.equal("a");
			} catch (err) {
				expect.fail(`removeDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should succeed removing multiple datasets", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				await facade.addDataset("b", mixedCourses, InsightDatasetKind.Sections);
				await facade.removeDataset("b");
				await facade.removeDataset("a");
				const result = await facade.listDatasets();
				expect(result).to.be.empty;
			} catch (err) {
				expect.fail(`removeDataset should not have thrown, but threw ${err}`);
			}
		});

		it("should remove after crash", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				const newInstance = new InsightFacade();
				const result = await newInstance.removeDataset("a");
				expect(result).to.deep.equal("a");
			} catch (err) {
				expect.fail(`removeDataset should not have thrown, but threw ${err}`);
			}
		});
	});

	describe("ListDataset", function () {
		beforeEach(async function () {
			await clearDisk();
			facade = new InsightFacade();
		});

		after(async function () {
			await clearDisk();
		});

		it("should return an empty array when no datasets are added", async function () {
			try {
				const result = await facade.listDatasets();
				expect(result).to.be.empty;
			} catch (err) {
				expect.fail(`listDatasets should not have thrown, but threw ${err}`);
			}
		});

		it("should return the one course added", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([{ id: "a", kind: InsightDatasetKind.Sections, numRows: 4 }]);
			} catch (err) {
				expect.fail(`listDatasets should not have thrown, but threw ${err}`);
			}
		});

		it("should return the two courses added", async function () {
			try {
				await facade.addDataset("a", oneValidCourse, InsightDatasetKind.Sections);
				await facade.addDataset("b", oneValidCourse, InsightDatasetKind.Sections);
				const result = await facade.listDatasets();
				expect(result).to.deep.equal([
					{ id: "a", kind: InsightDatasetKind.Sections, numRows: 4 },
					{ id: "b", kind: InsightDatasetKind.Sections, numRows: 4 },
				]);
			} catch (err) {
				expect.fail(`listDatasets should not have thrown, but threw ${err}`);
			}
		});
	});

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[] = []; // dummy value before being reassigned
			try {
				result = await facade.performQuery(input);
			} catch (err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${err}`);
				}
				// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
				// to determine what to put here :)
				if (expected === "InsightError") {
					expect(err).to.be.instanceOf(InsightError);
					return;
				} else if (expected === "ResultTooLargeError") {
					expect(err).to.be.instanceOf(ResultTooLargeError);
					return;
				} else {
					expect.fail(`performQuery rejected with unexpected error: ${err}`);
				}
			}
			if (errorExpected) {
				expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
			}
			// TODO: replace this failing assertion with your assertions. You will need to reason about the code in this function
			// to determine what to put here :)
			expect(result).to.be.lengthOf(expected.length);
			expect(result).to.have.deep.members(expected); //
			//expect(result).to.deep.equal(expected);
		}

		before(async function () {
			facade = new InsightFacade();
			await clearDisk();

			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("rooms", campus, InsightDatasetKind.Rooms),
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
				facade.addDataset("onecourse", oneValidCourse, InsightDatasetKind.Sections),
				facade.addDataset("test5000", section5000, InsightDatasetKind.Sections),
			];

			try {
				await Promise.all(loadDatasetPromises);
			} catch (err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${err}`);
			}
		});

		after(async function () {
			await clearDisk();
		});

		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it("[invalid/notObject.json] Query is not an object", checkQuery);
		it("[invalid/inputEmptyObject.json] Input empty object", checkQuery);
		it("[invalid/datasetNotAdded.json] Dataset not added", checkQuery);
		it("[invalid/large.json] Result > 5000", checkQuery);
		it("[invalid/twoDatasets.json] Selecting from 2 datasets", checkQuery);
		it("[invalid/twoDatasetsWhere.json] Querying 2 datasets", checkQuery);
		it("[invalid/missingOptions.json] Missing OPTIONS", checkQuery);
		it("[invalid/missingBody.json] Missing WHERE", checkQuery);
		it("[invalid/orderNotInCol.json] ORDER not in COLUMNS", checkQuery);
		it("[invalid/wildcardInvalid.json] Wildcard invalid", checkQuery);
		it("[invalid/GTNotNumber.json] GT not number", checkQuery);
		it("[invalid/EQWrongKey.json] EQ invalid key", checkQuery);
		it("[invalid/ISWrongKey.json] IS invalid key", checkQuery);
		it("[invalid/ISNotString.json] IS not string", checkQuery);
		it("[invalid/invalidField.json] Invalid key field", checkQuery);
		it("[invalid/emptyColumns.json] select empty array", checkQuery);
		it("[invalid/whereNotObject.json] WHERE not an object", checkQuery);
		it("[invalid/logicNotArray.json] OR not array", checkQuery);
		it("[invalid/logicEmpty.json] OR empty array", checkQuery);
		it("[invalid/EQInvalid.json] EQ a string", checkQuery);
		it("[invalid/ISInvalid.json] Is null", checkQuery);
		it("[invalid/NegateInvalid.json] NOT a empty object", checkQuery);
		it("[invalid/OptionsEmpty.json] OPTIONS empty object", checkQuery);
		it("[invalid/5001sections.json] 5001", checkQuery);
		it("[invalid/columnEmptyString.json] A", checkQuery);
		it("[invalid/extraKey.json] B", checkQuery);
		it("[invalid/invalidColumn.json] C", checkQuery);
		it("[invalid/LTEmpty.json] D", checkQuery);
		it("[invalid/not.json] E", checkQuery);
		it("[invalid/invalidID.json] F", checkQuery);
		it("[invalid/IDnoSuffix.json] G", checkQuery);

		// VALID
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[valid/complex.json] Complex query", checkQuery);
		it("[valid/wildcardBoth.json] Wildcard both", checkQuery);
		it("[valid/wildcardEnd.json] Wildcard end", checkQuery);
		it("[valid/wildcardStart.json] Wildcard start", checkQuery);
		it("[valid/ISEmptyString.json] IS empty string", checkQuery);
		it("[valid/singleCompare.json] single element in compare", checkQuery);
		it("[valid/5000sections.json] 5000", checkQuery);

		// C2
		it("[rooms_valid/rooms.json] Rooms dataset", checkQuery);
		it("[valid/orderByTwo.json] orderbytwo", checkQuery);
		it("[rooms_valid/basicCount.json] basic count", checkQuery);
		it("[invalid/twodatasetsApply.json] complex count", checkQuery);
		it("[invalid/sidewaysOrder.json] sideways order", checkQuery);
		it("[invalid/twodatasetsOrder.json]  order has 2 datasets ", checkQuery);
		it("[invalid/stringMismatch.json] ugh", checkQuery);
		it("[invalid/wrongAggregation.json] ughh", checkQuery);
		it("[invalid/groupMustBeArray.json] ughhh", checkQuery);
		it("[rooms_valid/basicCount.json] basic count", checkQuery);
		it("[rooms_valid/basicMin.json] basic count", checkQuery);
		it("[rooms_valid/basicSum.json] basic count", checkQuery);

	});
});
